"""add_travel_route_json

Revision ID: a1b2c3d4e5f6
Revises: e14d23a19e04
Create Date: 2026-08-17 17:24:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e14d23a19e04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trip_items', sa.Column('travel_data_json', sa.String(), nullable=True))
    op.add_column('trip_days', sa.Column('end_hotel_travel_json', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('trip_days', 'end_hotel_travel_json')
    op.drop_column('trip_items', 'travel_data_json')