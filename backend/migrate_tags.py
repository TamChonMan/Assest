from sqlmodel import Session, select, create_engine, SQLModel, text
from models import Asset, Tag, AssetTagLink
from database import engine

def migrate_tags():
    print("Starting Tag Migration...")
    
    # 1. Create new tables
    SQLModel.metadata.create_all(engine)
    print("Tables created (Tag, AssetTagLink).")
    
    with Session(engine) as session:
        # 2. Fetch all assets
        # Note: We modified the model, so 'tags' attribute is now a relationship list.
        # But the DB column 'tags' still holds the string (until we drop/rename it).
        # SQLModel might have issues if we try to access 'tags' and it expects a list but DB has string.
        # However, SQLModel/SQLAlchemy usually ignores columns not in model unless we select them.
        # Wait, I renamed `tags` to `tags_str` in model? No, I added `tags_str` and changed `tags` to Relationship.
        # This implies I should rely on the fact that `tags` column in DB is NOT `tags` relationship.
        # Actually, if I didn't rename the column in DB, SQLAlchemy might get confused if I try to access `asset.tags`.
        # THE DB COLUMN IS NAMED 'tags'. The Model field is 'tags' (Relationship).
        # This is a conflict. 
        # I should have renamed the DB column or mapped `tags_str` to the `tags` column.
        
        # Strategy: 
        # Use raw SQL to get the old string tags.
        # Populate new tables.
        # Then we can drop/nullify the old column.
        
        # Fetch ID and raw tags string
        results = session.exec(text("SELECT id, tags FROM asset WHERE tags IS NOT NULL AND tags != ''")).all()
        
        print(f"Found {len(results)} assets with tags.")
        
        for row in results:
            asset_id, tags_str = row
            if not tags_str: continue
            
            tag_names = [t.strip() for t in tags_str.split(",") if t.strip()]
            
            for name in tag_names:
                # Find or Create Tag
                tag = session.exec(select(Tag).where(Tag.name == name)).first()
                if not tag:
                    tag = Tag(name=name, color="#888888") # Default gray
                    session.add(tag)
                    session.commit()
                    session.refresh(tag)
                
                # Link
                # Check link exists
                link = session.exec(select(AssetTagLink).where(AssetTagLink.asset_id == asset_id, AssetTagLink.tag_id == tag.id)).first()
                if not link:
                    link = AssetTagLink(asset_id=asset_id, tag_id=tag.id)
                    session.add(link)
            
        session.commit()
        print("Migration complete. Tags moved to new table.")
        
        # Verify
        count = session.exec(select(Tag)).all()
        print(f"Total Unique Tags: {len(count)}")

if __name__ == "__main__":
    migrate_tags()
