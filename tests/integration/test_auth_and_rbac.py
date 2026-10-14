"""Integration tests for Authentication and RBAC endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from nse_pipeline.api.app import app
from nse_pipeline.api.dependencies import get_db
from nse_pipeline.database.repositories.user_repository import UserRepository


def test_auth_and_rbac_flow(test_db_session: Session):
    app.dependency_overrides[get_db] = lambda: test_db_session
    client = TestClient(app)

    # 1. Seed admin
    repo = UserRepository(test_db_session)
    admin = repo.seed_default_admin()
    assert admin.username == "admin"
    assert admin.email == "admin@nse.com"
    assert admin.role == "admin"

    # 2. Test bad credentials with email
    bad_login = client.post("/api/v1/auth/login", json={"email": "admin@nse.com", "password": "wrong"})
    assert bad_login.status_code == 401

    # 3. Test correct admin login using Email ID
    login_resp = client.post("/api/v1/auth/login", json={"email": "admin@nse.com", "password": "admin123"})
    assert login_resp.status_code == 200
    admin_auth = login_resp.json()
    admin_token = admin_auth["token"]
    assert admin_auth["user"]["email"] == "admin@nse.com"
    assert admin_auth["user"]["role"] == "admin"
    assert "seasonality" in admin_auth["user"]["accessible_screens"]

    # 4. Profile endpoint /me
    me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "admin@nse.com"

    # 5. Admin creates user with Email ID and ONLY seasonality access
    create_resp = client.post(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "email": "seasonal_trader@example.com",
            "username": "seasonal_trader",
            "password": "secretpassword",
            "full_name": "Seasonal Tester",
            "role": "user",
            "accessible_screens": ["seasonality"],
            "is_active": True,
        },
    )
    assert create_resp.status_code == 201
    created_user = create_resp.json()
    assert created_user["email"] == "seasonal_trader@example.com"
    assert created_user["accessible_screens"] == ["seasonality"]

    # 6. Seasonal user logs in using their Email ID
    seasonal_login = client.post(
        "/api/v1/auth/login",
        json={"email": "seasonal_trader@example.com", "password": "secretpassword"},
    )
    assert seasonal_login.status_code == 200
    seasonal_token = seasonal_login.json()["token"]
    assert seasonal_login.json()["user"]["accessible_screens"] == ["seasonality"]

    # 7. Seasonal user forbidden from admin users list
    forbidden_resp = client.get("/api/v1/users", headers={"Authorization": f"Bearer {seasonal_token}"})
    assert forbidden_resp.status_code == 403

    # 8. Admin updates seasonal user screens and email
    user_id = created_user["id"]
    update_resp = client.put(
        f"/api/v1/users/{user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"email": "updated_trader@example.com", "accessible_screens": ["seasonality", "explorer"]},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["email"] == "updated_trader@example.com"
    assert set(update_resp.json()["accessible_screens"]) == {"seasonality", "explorer"}

    # 9. Admin deletes user
    del_resp = client.delete(f"/api/v1/users/{user_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert del_resp.status_code == 200

    # 10. Attempting to delete only remaining admin is prevented
    del_admin = client.delete(f"/api/v1/users/{admin.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert del_admin.status_code == 400

    app.dependency_overrides.clear()
