"""add_city_to_places

Revision ID: e14d23a19e04
Revises: d3d04d65ca78
Create Date: 2026-08-17 12:11:23.021127

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e14d23a19e04'
down_revision: Union[str, None] = 'd3d04d65ca78'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('places', sa.Column('city', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('places', 'city')
