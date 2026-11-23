from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)

from sqlalchemy.orm import relationship

from db.db import Base

plant_categories = Table(
    "plant_categories",
    Base.metadata,

    Column(
        "plant_id",
        Integer,
        ForeignKey("plants.id", ondelete="CASCADE"),
        primary_key=True,
    ),

    Column(
        "category_id",
        Integer,
        ForeignKey("categories.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    name = Column(String(64), unique=True, nullable=False, index=True)
    description = Column(Text)

    staff = relationship("GardenStaff", back_populates="role")


class GardenStaff(Base):
    __tablename__ = "garden_staff"

    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)

    role = relationship("Role", back_populates="staff")
    exhibits = relationship("Exhibit", back_populates="curator")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), unique=True, nullable=False, index=True)
    description = Column(Text)

    plants = relationship(
        "Plant",
        secondary=plant_categories,
        back_populates="categories",
    )


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    zone_type = Column(String(64), nullable=False)
    sector_code = Column(String(64), unique=True, nullable=False, index=True)
    description = Column(Text)

    exhibits = relationship("Exhibit", back_populates="location")


class Plant(Base):
    __tablename__ = "plants"

    id = Column(Integer, primary_key=True, index=True)
    russian_name = Column(String(255), nullable=False, index=True)
    latin_name = Column(String(255), nullable=False, unique=True, index=True)
    family = Column(String(128), nullable=False, index=True)
    life_form = Column(String(128), nullable=False)
    description = Column(Text, nullable=False)
    geographic_origin = Column(String(255), nullable=False)

    characteristics = relationship(
        "PlantCharacteristic",
        back_populates="plant",
        uselist=False,
        cascade="all, delete-orphan",
    )

    categories = relationship(
        "Category",
        secondary=plant_categories,
        back_populates="plants",
    )

    exhibits = relationship(
        "Exhibit",
        back_populates="plant",
        cascade="all, delete-orphan",
    )


class PlantCharacteristic(Base):
    __tablename__ = "plant_characteristics"

    id = Column(Integer, primary_key=True)
    plant_id = Column(
        Integer,
        ForeignKey("plants.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    
    watering = Column(String(255), nullable=False)
    light = Column(String(255), nullable=False)
    temperature = Column(String(128), nullable=True)
    humidity = Column(String(128), nullable=True)

    plant = relationship("Plant", back_populates="characteristics")


class Exhibit(Base):
    __tablename__ = "exhibits"

    id = Column(Integer, primary_key=True)
    inventory_number = Column(String(64), unique=True, nullable=False, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id", ondelete="RESTRICT"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False)
    curator_id = Column(Integer, ForeignKey("garden_staff.id", ondelete="SET NULL"), nullable=True)
    care_status = Column(String(64), nullable=False, default="stable")
    planted_at = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)

    plant = relationship("Plant", back_populates="exhibits")
    location = relationship("Location", back_populates="exhibits")
    curator = relationship("GardenStaff", back_populates="exhibits")
