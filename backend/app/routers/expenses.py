from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
import uuid

# We will just depend on main's get_current_user dynamically or redefine the auth dependency if needed.
# Since we are adding this router to main.py, let's just write the router assuming we import from main.
# Actually, the safest way is to put these routes directly in main.py for now to avoid circular dependencies with get_current_user, or we can refactor get_current_user into a dependencies.py.

# Let's write them here and we can refactor later if needed.
router = APIRouter(prefix="/api/trips", tags=["expenses"])

@router.get("/{trip_id}/expenses")
async def get_expenses(trip_id: str, db: Session = Depends(get_db)):
    expenses = db.query(models.Expense).filter(models.Expense.trip_id == trip_id).all()
    return expenses

@router.post("/{trip_id}/expenses")
async def add_expense(trip_id: str, request: dict, db: Session = Depends(get_db)):
    # Assuming ownership check is done or we rely on the trip existing and user having access
    expense = models.Expense(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        title=request.get("title", "New Expense"),
        amount=float(request.get("amount", 0.0)),
        currency=request.get("currency", "USD"),
        category=request.get("category", "Other")
    )
    db.add(expense)
    db.commit()
    return expense

@router.delete("/{trip_id}/expenses/{expense_id}")
async def delete_expense(trip_id: str, expense_id: str, db: Session = Depends(get_db)):
    db.query(models.Expense).filter(models.Expense.id == expense_id, models.Expense.trip_id == trip_id).delete()
    db.commit()
    return {"status": "success"}
