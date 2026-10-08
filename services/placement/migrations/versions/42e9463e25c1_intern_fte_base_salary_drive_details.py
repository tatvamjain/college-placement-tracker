"""intern fte, base salary, drive details

Revision ID: 42e9463e25c1
Revises: 7645fc3c4e53
Create Date: 2026-10-09 01:11:43.111630

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42e9463e25c1'
down_revision: Union[str, Sequence[str], None] = '7645fc3c4e53'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'intern_fte'")
    op.add_column("drive_roles", sa.Column("base_inr", sa.BigInteger(), nullable=True))
    op.create_check_constraint("base_non_negative", "drive_roles", "base_inr >= 0")
    op.create_check_constraint(
        "base_within_ctc", "drive_roles", "base_inr IS NULL OR ctc_inr IS NULL OR base_inr <= ctc_inr"
    )
    op.add_column("drives", sa.Column("details", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("drives", "details")
    op.drop_constraint("base_within_ctc", "drive_roles", type_="check")
    op.drop_constraint("base_non_negative", "drive_roles", type_="check")
    op.drop_column("drive_roles", "base_inr")
    # Postgres can't drop an enum value, so 'intern_fte' stays in job_type.
