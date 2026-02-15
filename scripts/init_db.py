
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.core.database import engine, Base, SessionLocal
from backend.core.models import User
from backend.core.security import get_password_hash

def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")

    db = SessionLocal()
    try:
        # Check if admin exists
        user = db.query(User).filter(User.email == "admin@verifair.ai").first()
        if not user:
            print("Creating default admin user...")
            admin_user = User(
                email="admin@verifair.ai",
                hashed_password=get_password_hash("admin123"),
                full_name="System Admin"
            )
            db.add(admin_user)
            db.commit()
            print("Admin user created: admin@verifair.ai / admin123")
        else:
            print("Admin user already exists.")
    except Exception as e:
        print(f"Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
