from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from database import get_session
from models import Tag, AssetTagLink

router = APIRouter(
    prefix="/tags",
    tags=["tags"],
)

@router.get("/", response_model=List[Tag])
def list_tags(session: Session = Depends(get_session)):
    return session.exec(select(Tag)).all()

@router.post("/", response_model=Tag)
def create_tag(tag: Tag, session: Session = Depends(get_session)):
    existing = session.exec(select(Tag).where(Tag.name == tag.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag already exists")
    
    # Ensure default color if missing
    if not tag.color:
        tag.color = "#888888"
        
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag

@router.delete("/{tag_id}")
def delete_tag(tag_id: int, session: Session = Depends(get_session)):
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
        
    # Delete associated links
    from sqlmodel import delete
    session.exec(delete(AssetTagLink).where(AssetTagLink.tag_id == tag_id))
        
    session.delete(tag)
    session.commit()
    return {"ok": True}
