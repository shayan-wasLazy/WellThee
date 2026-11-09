from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models import Goal, User
from app.schemas import GoalCreate, GoalRead, GoalUpdate

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalRead])
def list_goals(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Goal]:
    return list(db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.target_date.asc().nullslast(), Goal.created_at.desc())))


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Goal:
    if payload.saved_amount > payload.target_amount:
        raise HTTPException(status_code=422, detail="Saved amount cannot exceed the target.")
    goal = Goal(user_id=user.id, **payload.model_dump())
    goal.currency = payload.currency.upper()
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=GoalRead)
def update_goal(
    goal_id: str,
    payload: GoalUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Goal:
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id))
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found.")
    updates = payload.model_dump(exclude_unset=True)
    if any(value is None for value in updates.values()):
        raise HTTPException(status_code=422, detail="Goal fields cannot be set to null.")
    new_target = updates.get("target_amount", goal.target_amount)
    new_saved = updates.get("saved_amount", goal.saved_amount)
    if new_saved > new_target:
        raise HTTPException(status_code=422, detail="Saved amount cannot exceed the target.")
    for key, value in updates.items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id))
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found.")
    db.delete(goal)
    db.commit()
