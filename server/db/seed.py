from datetime import date

from db.crud import PlantInput, insert_plants
from db.db import SessionLocal, init_db
from db.models import Category, GardenStaff, Location, Role
from security import hash_password


def _get_or_create_role(db, name: str, description: str) -> Role:
    role = db.query(Role).filter(Role.name == name).one_or_none()
    if role is None:
        role = Role(name=name, description=description)
        db.add(role)
        db.flush()
    return role


def _get_or_create_staff(db, username: str, **kwargs) -> GardenStaff:
    staff = db.query(GardenStaff).filter(GardenStaff.username == username).one_or_none()
    if staff is None:
        staff = GardenStaff(username=username, **kwargs)
        db.add(staff)
        db.flush()
    return staff


def _get_or_create_location(db, sector_code: str, **kwargs) -> Location:
    location = (
        db.query(Location).filter(Location.sector_code == sector_code).one_or_none()
    )
    if location is None:
        location = Location(sector_code=sector_code, **kwargs)
        db.add(location)
        db.flush()
    return location


def _get_or_create_category(db, name: str, description: str) -> Category:
    category = db.query(Category).filter(Category.name == name).one_or_none()
    if category is None:
        category = Category(name=name, description=description)
        db.add(category)
        db.flush()
    return category


def seed():
    init_db()
    db = SessionLocal()
    try:
        superadmin = _get_or_create_role(
            db, "superadmin", "Мегаадмин"
        )
        agronomist = _get_or_create_role(
            db, "agronomist", "Куратор коллекций и статусов ухода"
        )
        _get_or_create_role(db, "technician", "Техобслуживание экспозиций")

        curator = _get_or_create_staff(
            db,
            "i.goliubo",
            full_name="Хачатурян Глеб Олегович",
            email="goliubo@udsu-garden.local",
            password_hash=hash_password("change-me"),
            role_id=agronomist.id,
        )
        _get_or_create_staff(
            db,
            "admin",
            full_name="Админ сада",
            email="ya_admin@udsu-garden.local",
            password_hash=hash_password("change-me"),
            role_id=superadmin.id,
        )

        _get_or_create_location(
            db,
            "OR-1",
            name="Тропическая оранжерея",
            zone_type="greenhouse",
            description="Тропические и субтропические виды",
        )
        _get_or_create_location(
            db,
            "OR-2",
            name="Субтропическая оранжерея",
            zone_type="greenhouse",
            description="Суккуленты и субтропические культуры",
        )
        _get_or_create_location(
            db,
            "OG-D1",
            name="Дендрарий, сектор 1",
            zone_type="open_ground",
            description="Хвойные и лиственные деревья",
        )
        _get_or_create_location(
            db,
            "OG-A1",
            name="Альпийская горка",
            zone_type="open_ground",
            description="Горные и холодостойкие травянистые виды",
        )
        _get_or_create_location(
            db,
            "OG-M1",
            name="Участок лекарственных растений",
            zone_type="open_ground",
            description="Лекарственные культуры открытого грунта",
        )

        _get_or_create_category(db, "тропические", "Оранжерейные тропические виды")
        _get_or_create_category(db, "субтропические", "Субтропические культуры")
        _get_or_create_category(db, "лекарственные", "Лекарственные растения")
        _get_or_create_category(db, "хвойные", "Хвойные породы дендрария")
        _get_or_create_category(db, "редкие", "Виды Красной книги Удмуртии и РФ")
        db.flush()

        plants_data = [
            PlantInput(
                russian_name="Монстера деликатесная",
                latin_name="Monstera deliciosa",
                family="Araceae",
                life_form="лиана",
                description="Крупная вечнозелёная лиана с рассечёнными листьями, используется в учебных экспозициях тропиков.",
                geographic_origin="Центральная Америка",
                watering="умеренный, без застоя воды",
                light="яркий рассеянный",
                temperature="20–26 °C",
                humidity="высокая",
                category_names=["тропические"],
                inventory_number="INV-0001",
                location_sector_code="OR-1",
                care_status="stable",
                curator_id=curator.id,
                planted_at=date(2018, 4, 12),
            ),

            PlantInput(
                russian_name="Фикус бенджамина",
                latin_name="Ficus benjamina",
                family="Moraceae",
                life_form="дерево",
                description="Вечнозелёное дерево с поникающими побегами, типичный объект оранжерейной коллекции.",
                geographic_origin="Юго-Восточная Азия",
                watering="регулярный, почва слегка влажная",
                light="яркий рассеянный",
                temperature="18–24 °C",
                humidity="средняя",
                category_names=["тропические", "субтропические"],
                inventory_number="INV-0002",
                location_sector_code="OR-1",
                care_status="stable",
                curator_id=curator.id,
                planted_at=date(2016, 9, 3),
            ),

            PlantInput(
                russian_name="Алоэ настоящее",
                latin_name="Aloe vera",
                family="Asphodelaceae",
                life_form="суккулент",
                description="Лекарственный суккулент, демонстрируется на занятиях по фармакогнозии.",
                geographic_origin="Аравийский полуостров",
                watering="редкий, после просыхания субстрата",
                light="яркий прямой",
                temperature="18–28 °C",
                humidity="низкая",
                category_names=["лекарственные", "субтропические"],
                inventory_number="INV-0003",
                location_sector_code="OR-2",
                care_status="stable",
                curator_id=curator.id,
                planted_at=date(2019, 2, 20),
            ),

            PlantInput(
                russian_name="Каланхоэ Дегремона",
                latin_name="Kalanchoe daigremontiana",
                family="Crassulaceae",
                life_form="суккулент",
                description="Живородящий суккулент, удобен для демонстрации вегетативного размножения.",
                geographic_origin="Мадагаскар",
                watering="умеренный",
                light="яркий",
                temperature="18–25 °C",
                humidity="низкая",
                category_names=["лекарственные", "субтропические"],
                inventory_number="INV-0004",
                location_sector_code="OR-2",
                care_status="needs_attention",
                curator_id=curator.id,
                planted_at=date(2021, 11, 8),
                notes="Требуется пересадка",
            ),

            PlantInput(
                russian_name="Банан японский",
                latin_name="Musa basjoo",
                family="Musaceae",
                life_form="травянистое",
                description="Крупное травянистое растение тропического облика, используется в оранжерейной экспозиции.",
                geographic_origin="Восточная Азия",
                watering="обильный в период роста",
                light="яркий",
                temperature="22–28 °C",
                humidity="высокая",
                category_names=["тропические"],
                inventory_number="INV-0005",
                location_sector_code="OR-1",
                care_status="stable",
                curator_id=curator.id,
                planted_at=date(2017, 6, 1),
            ),

            PlantInput(
                russian_name="Сосна обыкновенная",
                latin_name="Pinus sylvestris",
                family="Pinaceae",
                life_form="дерево",
                description="Местная хвойная порода, представлена в дендрарии как эталонный вид таёжной зоны.",
                geographic_origin="Евразия",
                watering="природные осадки",
                light="полное солнце",
                temperature="устойчива к морозу",
                humidity="средняя",
                category_names=["хвойные"],
                inventory_number="INV-0006",
                location_sector_code="OG-D1",
                care_status="stable",
                curator_id=curator.id,
                planted_at=date(2005, 5, 15),
            ),

            PlantInput(
                russian_name="Ель колючая",
                latin_name="Picea pungens",
                family="Pinaceae",
                life_form="дерево",
                description="Декоративная хвойная порода североамериканского происхождения в дендрарии.",
                geographic_origin="Северная Америка",
                watering="природные осадки",
                light="полное солнце",
                temperature="устойчива к морозу",
                humidity="средняя",
                category_names=["хвойные"],
                inventory_number="INV-0007",
                location_sector_code="OG-D1",
                care_status="stable",
                curator_id=curator.id,
                planted_at=date(2010, 4, 22),
            ),

            PlantInput(
                russian_name="Венерин башмачок настоящий",
                latin_name="Cypripedium calceolus",
                family="Orchidaceae",
                life_form="травянистое",
                description="Редкий вид орхидей, внесён в Красную книгу РФ и Удмуртии; содержится в охраняемой экспозиции.",
                geographic_origin="Евразия",
                watering="умеренный, влажный дренированный грунт",
                light="полутень",
                temperature="прохладное лето",
                humidity="высокая",
                category_names=["редкие"],
                inventory_number="INV-0008",
                location_sector_code="OG-A1",
                care_status="protected",
                curator_id=curator.id,
                planted_at=date(2020, 5, 18),
                notes="Охраняемый экземпляр, доступ ограничен",
            ),

            PlantInput(
                russian_name="Родиола розовая",
                latin_name="Rhodiola rosea",
                family="Crassulaceae",
                life_form="травянистое",
                description="Горное лекарственное растение, демонстрируется на альпийской горке.",
                geographic_origin="Арктика и высокогорья Евразии",
                watering="умеренный",
                light="яркий",
                temperature="холодостойкая",
                humidity="средняя",
                category_names=["лекарственные", "редкие"],
                inventory_number="INV-0009",
                location_sector_code="OG-A1",
                care_status="stable",
                curator_id=curator.id,
                planted_at=date(2019, 6, 7),
            ),
            
            PlantInput(
                russian_name="Ландыш майский",
                latin_name="Convallaria majalis",
                family="Asparagaceae",
                life_form="травянистое",
                description="Лекарственное и декоративное растение тенистых участков, используется в учебных маршрутах.",
                geographic_origin="Европа",
                watering="умеренный",
                light="полутень",
                temperature="зимостойкий",
                humidity="средняя",
                category_names=["лекарственные"],
                inventory_number="INV-0010",
                location_sector_code="OG-M1",
                care_status="stable",
                curator_id=curator.id,
                planted_at=date(2014, 5, 9),
            ),
        ]

        inserted = insert_plants(db, plants_data)
        print(f"Добавлено растений: {len(inserted)}")
        for plant in inserted:
            exhibit = plant.exhibits[0] if plant.exhibits else None
            location = exhibit.location.sector_code if exhibit else "-"
            print(
                f"{exhibit.inventory_number if exhibit else '-':<10} "
                f"{plant.russian_name} / {plant.latin_name} "
                f"[{location}]"
            )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
