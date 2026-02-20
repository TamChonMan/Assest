from typing import List
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session, select
from database import get_session
from models import Asset, Tag, AssetTagLink

router = APIRouter(
    prefix="/assets",
    tags=["assets"],
)

@router.get("/", response_model=List[Asset])
def list_assets(session: Session = Depends(get_session)):
    return session.exec(select(Asset)).all()

@router.put("/{asset_id}/tags", response_model=List[Tag])
def update_asset_tags(
    asset_id: int, 
    tag_ids: List[int] = Body(...), 
    session: Session = Depends(get_session)
):
    asset = session.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    # Clear existing links
    existing_links = session.exec(select(AssetTagLink).where(AssetTagLink.asset_id == asset_id)).all()
    for link in existing_links:
        session.delete(link)
        
    # Create new links
    new_tags = []
    for tag_id in tag_ids:
        tag = session.get(Tag, tag_id)
        if tag:
            link = AssetTagLink(asset_id=asset_id, tag_id=tag_id)
            session.add(link)
            new_tags.append(tag)
            
    session.commit()
    session.refresh(asset)
    
    # Return updated tags
    return new_tags
