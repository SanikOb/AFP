from datetime import date
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, FiniteFloat, StringConstraints, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from db.crud import PlantInput, apply_plant_input, insert_plant
from db.models import Exhibit, GardenStaff, Plant
from security import Database, curator, curator_locations

router = APIRouter(prefix="/plants")
Curator = Annotated[GardenStaff, Depends(curator)]
RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
ShortText = Annotated[RequiredText, StringConstraints(max_length=128)]
NameText = Annotated[RequiredText, StringConstraints(max_length=255)]


class PlantForm(BaseModel):
    russian_name: NameText
    latin_name: NameText
    family: ShortText
    life_form: ShortText
    description: RequiredText
    geographic_origin: NameText
    watering: NameText
    light: NameText
    temperature: ShortText | None = None
    humidity: ShortText | None = None
    categories: list[ShortText] = Field(default_factory=list)
    inventory_number: Annotated[RequiredText, StringConstraints(max_length=64)] | None = None
    location: NameText | None = None
    x: FiniteFloat
    y: FiniteFloat
    care_status: Literal["stable", "needs_attention", "protected", "written_off"] = "stable"
    planted_at: date | None = None
    notes: str | None = None

    @field_validator(
        "temperature", "humidity", "inventory_number", "location", "planted_at", "notes",
        mode="before",
    )
    @classmethod
    def blank_as_null(cls, value):
        return None if isinstance(value, str) and not value.strip() else value


def exhibit_data(exhibit: Exhibit) -> dict:
    return {
        "inventory_number": exhibit.inventory_number,
        "location": exhibit.location.name,
        "x": exhibit.x,
        "y": exhibit.y,
        "care_status": exhibit.care_status,
        "planted_at": exhibit.planted_at,
        "notes": exhibit.notes,
    }


def plant_data(plant: Plant) -> dict:
    characteristics = plant.characteristics
    exhibits = [exhibit_data(item) for item in sorted(plant.exhibits, key=lambda item: item.id)]
    return {
        "id": plant.id,
        "russian_name": plant.russian_name,
        "latin_name": plant.latin_name,
        "family": plant.family,
        "life_form": plant.life_form,
        "description": plant.description,
        "geographic_origin": plant.geographic_origin,
        "watering": characteristics.watering if characteristics else None,
        "light": characteristics.light if characteristics else None,
        "temperature": characteristics.temperature if characteristics else None,
        "humidity": characteristics.humidity if characteristics else None,
        "categories": [category.name for category in plant.categories],
        **(exhibits[0] if exhibits else dict.fromkeys(
            ("inventory_number", "location", "x", "y", "care_status", "planted_at", "notes")
        )),
        "exhibits": exhibits,
    }


def prepare_input(
    db: Session, form: PlantForm, staff: GardenStaff, exhibit: Exhibit | None
) -> PlantInput:
    values = form.model_dump(exclude={"categories", "location", "inventory_number"})
    location = next(
        (item for item in curator_locations(db, staff) if item.name == form.location), None
    )
    if location is None:
        raise HTTPException(403, "Выберите локацию из назначенных вам секторов")
    if exhibit and exhibit.location.name == location.name:
        location = exhibit.location
    inventory_number = form.inventory_number or (
        exhibit.inventory_number if exhibit else f"AFP-{uuid4().hex}"
    )
    return PlantInput(
        **values,
        category_names=form.categories,
        inventory_number=inventory_number,
        location_id=location.id,
        curator_id=staff.id,
    )


def get_plant(db: Session, plant_id: int) -> Plant:
    plant = db.get(Plant, plant_id)
    if plant is None:
        raise HTTPException(404, "Растение не найдено")
    return plant


def managed_exhibit(db: Session, plant: Plant, staff: GardenStaff) -> Exhibit:
    exhibit = min(plant.exhibits, key=lambda item: item.id, default=None)
    allowed = {location.id for location in curator_locations(db, staff)}
    if exhibit is None or exhibit.location_id not in allowed:
        raise HTTPException(403, "Растение находится вне назначенных вам секторов")
    return exhibit


def save_plant(db: Session, form: PlantForm, staff: GardenStaff, plant: Plant | None = None) -> dict:
    try:
        exhibit = managed_exhibit(db, plant, staff) if plant else None
        data = prepare_input(db, form, staff, exhibit)
        if plant is None:
            plant = insert_plant(db, data, commit=False)
        else:
            duplicate_id = db.scalar(
                select(Plant.id).filter(Plant.latin_name == data.latin_name, Plant.id != plant.id)
            )
            if duplicate_id is not None:
                raise ValueError(f"Растение с латинским названием {data.latin_name} уже есть")
            apply_plant_input(db, plant, data, exhibit)

        db.commit()
    except ValueError as error:
        db.rollback()
        raise HTTPException(409, str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Конфликт данных. Обновите каталог и повторите попытку.") from error
    return plant_data(plant)


@router.get("")
def list_plants(db: Database):
    statement = select(Plant).options(
        selectinload(Plant.characteristics),
        selectinload(Plant.categories),
        selectinload(Plant.exhibits).selectinload(Exhibit.location),
    ).order_by(Plant.id)
    return [plant_data(plant) for plant in db.scalars(statement)]


@router.post("", status_code=201)
def create_plant(form: PlantForm, db: Database, staff: Curator):
    return save_plant(db, form, staff)


@router.put("/{plant_id}")
def update_plant(plant_id: int, form: PlantForm, db: Database, staff: Curator):
    return save_plant(db, form, staff, get_plant(db, plant_id))


@router.post("/{plant_id}/retire")
def retire_plant(plant_id: int, db: Database, staff: Curator):
    plant = get_plant(db, plant_id)
    exhibit = managed_exhibit(db, plant, staff)
    exhibit.care_status = "written_off"
    db.commit()
    return plant_data(plant)
