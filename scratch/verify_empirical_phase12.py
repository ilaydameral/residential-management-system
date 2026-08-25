import urllib.request
import urllib.parse
import json
import base64
from datetime import datetime, timedelta, timezone

BASE_URL = "http://localhost:5000"

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

def http_request(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, method=method, headers=headers)
    body_bytes = None
    if data is not None:
        body_bytes = json.dumps(data).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(req, data=body_bytes) as resp:
            resp_body = resp.read().decode("utf-8")
            status_code = resp.status
            return status_code, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = err_body
        return e.code, parsed

def decode_jwt_user_id(token):
    payload_b64 = token.split(".")[1]
    padding = "=" * (4 - len(payload_b64) % 4)
    decoded = json.loads(base64.b64decode(payload_b64 + padding).decode("utf-8"))
    return int(decoded["sub"])

def get_token(username_or_email, passwords):
    if isinstance(passwords, str):
        passwords = [passwords]
    for pwd in passwords:
        status, body = http_request(f"{BASE_URL}/api/auth/login", method="POST", data={
            "usernameOrEmail": username_or_email,
            "password": pwd
        })
        if status == 200 and "accessToken" in body:
            return body["accessToken"]
    raise Exception(f"Login failed for {username_or_email}")

def main():
    log("Starting Empirical Verification of Phase 12 Commit 4...")

    # 1. Login Accounts
    manager_token = get_token("manager@example.com", ["Manager123!", "Password123!"])
    resident_token = get_token("resident@example.com", ["Resident123!", "Password123!"])
    admin_token = get_token("admin@example.com", ["Admin123!", "Admin2026!", "Password123!"])

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    manager_headers = {"Authorization": f"Bearer {manager_token}"}
    resident_headers = {"Authorization": f"Bearer {resident_token}"}

    log("Successfully authenticated Admin, Manager, and Resident accounts.")

    resident_user_id = decode_jwt_user_id(resident_token)
    log(f"Resident A User ID from JWT: {resident_user_id}")

    # Fetch resident units
    status, u_resp = http_request(f"{BASE_URL}/api/resident/my-units", headers=resident_headers)
    if status != 200 or len(u_resp) == 0:
        log(f"Creating active UnitOccupancy for Resident A (User {resident_user_id}) on Unit 35...")
        occ_payload = {
            "userId": resident_user_id,
            "occupancyTypeId": 1,
            "startDate": (datetime.now(timezone.utc) - timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "endDate": None
        }
        o_status, o_created = http_request(f"{BASE_URL}/api/units/35/occupancies", method="POST", data=occ_payload, headers=admin_headers)
        log(f"Occupancy creation status: {o_status}")
        status, u_resp = http_request(f"{BASE_URL}/api/resident/my-units", headers=resident_headers)

    assert len(u_resp) > 0, "Failed to get active units for resident"
    unit_id = u_resp[0]["unitId"]
    log(f"Using Unit ID: {unit_id} ({u_resp[0]['buildingName']} No: {u_resp[0]['unitNumber']}) for Resident A testing.")

    # =========================================================================
    # TEST 1: VISITOR TWO-SESSION & LIFECYCLE
    # =========================================================================
    log("--- TEST 1: VISITOR TWO-SESSION & LIFECYCLE ---")

    arr_time = (datetime.now(timezone.utc) + timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    dep_time = (datetime.now(timezone.utc) + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ")

    visitor_payload = {
        "unitId": unit_id,
        "visitorName": "Empirical Test Visitor",
        "visitorPhone": "05329998877",
        "visitorType": "GUEST",
        "vehiclePlate": "34 EMP 99",
        "expectedArrival": arr_time,
        "expectedDeparture": dep_time
    }

    status, created_visitor = http_request(f"{BASE_URL}/api/resident/visitors", method="POST", data=visitor_payload, headers=resident_headers)
    assert status == 201, f"Create visitor failed: {status} {created_visitor}"
    visitor_id = created_visitor["id"]
    access_code = created_visitor["accessCode"]

    log(f"Resident A created EXPECTED visitor (ID: {visitor_id}, Code: {access_code}, Status: {created_visitor['status']})")
    assert created_visitor["status"] == "EXPECTED"
    assert len(access_code) == 6

    # Admin / Authorized Manager B checks visitor in
    status, checked_in_visitor = http_request(f"{BASE_URL}/api/management/visitors/{visitor_id}/check-in", method="POST", headers=admin_headers)
    assert status == 200, f"Check-in failed: {status} {checked_in_visitor}"

    log(f"Admin / Authorized Manager B checked visitor in. New Status: {checked_in_visitor['status']}, CheckedInAt: {checked_in_visitor['checkedInAt']}")
    assert checked_in_visitor["status"] == "CHECKED_IN"
    assert checked_in_visitor["checkedInAt"] is not None

    # Verify Resident A notification
    status, notifications = http_request(f"{BASE_URL}/api/notifications", headers=resident_headers)
    assert status == 200
    visitor_notifs = [n for n in notifications if n.get("notificationType") == "VISITOR_CHECKED_IN" or n.get("type") == "VISITOR_CHECKED_IN"]
    log(f"Resident A received {len(visitor_notifs)} VISITOR_CHECKED_IN notification(s). Title: '{visitor_notifs[0]['title']}' - Message: '{visitor_notifs[0]['message']}'")
    assert len(visitor_notifs) > 0

    # Admin / Authorized Manager B checks visitor out
    status, checked_out_visitor = http_request(f"{BASE_URL}/api/management/visitors/{visitor_id}/check-out", method="POST", headers=admin_headers)
    assert status == 200, f"Check-out failed: {status} {checked_out_visitor}"

    log(f"Admin / Authorized Manager B checked visitor out. New Status: {checked_out_visitor['status']}, CheckedOutAt: {checked_out_visitor['checkedOutAt']}")
    assert checked_out_visitor["status"] == "CHECKED_OUT"
    assert checked_out_visitor["checkedOutAt"] is not None

    # =========================================================================
    # TEST 2: VEHICLE FLOW & NORMALIZATION
    # =========================================================================
    log("--- TEST 2: VEHICLE FLOW & NORMALIZATION ---")

    raw_plate = "   34   emp   123   "
    vehicle_payload = {
        "unitId": unit_id,
        "plateNumber": raw_plate,
        "vehicleType": "CAR",
        "brandModel": "Empirical Brand",
        "color": "Kırmızı"
    }

    status, created_veh = http_request(f"{BASE_URL}/api/resident/vehicles", method="POST", data=vehicle_payload, headers=resident_headers)
    assert status == 201, f"Create vehicle failed: {status} {created_veh}"
    vehicle_id = created_veh["id"]

    log(f"Registered raw plate '{raw_plate}' -> Server returned normalized plate: '{created_veh['plateNumber']}'")
    assert created_veh["plateNumber"] == "34 EMP 123"

    # Edit brand/model
    status, edited_veh = http_request(f"{BASE_URL}/api/resident/vehicles/{vehicle_id}", method="PUT", data={
        "vehicleType": "CAR",
        "brandModel": "Empirical Brand Turbo",
        "color": "Mavi"
    }, headers=resident_headers)
    assert status == 200, f"Edit vehicle failed: {status} {edited_veh}"

    log(f"Updated vehicle details -> brandModel: '{edited_veh['brandModel']}', color: '{edited_veh['color']}'")
    assert edited_veh["brandModel"] == "Empirical Brand Turbo"

    # Deactivate vehicle
    status, deact_veh = http_request(f"{BASE_URL}/api/resident/vehicles/{vehicle_id}/status?isActive=false", method="PUT", headers=resident_headers)
    assert status == 200
    log(f"Deactivated vehicle -> isActive: {deact_veh['isActive']}")
    assert deact_veh["isActive"] == False

    # Reactivate vehicle
    status, react_veh = http_request(f"{BASE_URL}/api/resident/vehicles/{vehicle_id}/status?isActive=true", method="PUT", headers=resident_headers)
    assert status == 200
    log(f"Reactivated vehicle -> isActive: {react_veh['isActive']}")
    assert react_veh["isActive"] == True

    # Attempt duplicate active plate registration
    status, dup_resp = http_request(f"{BASE_URL}/api/resident/vehicles", method="POST", data={
        "unitId": unit_id,
        "plateNumber": "34 EMP 123",
        "vehicleType": "CAR"
    }, headers=resident_headers)

    log(f"Duplicate active plate attempt status: {status} (Response: {dup_resp})")
    assert status in [400, 409], f"Expected 400/409 duplicate error, got {status}"

    # =========================================================================
    # TEST 3: MANAGER SCOPE ISOLATION
    # =========================================================================
    log("--- TEST 3: MANAGER SCOPE ISOLATION ---")

    # Manager B scope check
    status, mgmt_visitors_res = http_request(f"{BASE_URL}/api/management/visitors", headers=manager_headers)
    assert status == 200
    building5_visitors = [v for v in mgmt_visitors_res['items'] if v['buildingName'] == 'Akdeniz Apartments']
    log(f"Manager scoped query returned {len(mgmt_visitors_res['items'])} visitor(s). Unauthorized Building 5 visitors in manager scope: {len(building5_visitors)} (0 expected)")
    assert len(building5_visitors) == 0

    status, mgmt_veh_res = http_request(f"{BASE_URL}/api/management/vehicles", headers=manager_headers)
    assert status == 200
    building5_vehicles = [v for v in mgmt_veh_res['items'] if v['buildingName'] == 'Akdeniz Apartments']
    log(f"Manager scoped query returned {len(mgmt_veh_res['items'])} vehicle(s). Unauthorized Building 5 vehicles in manager scope: {len(building5_vehicles)} (0 expected)")
    assert len(building5_vehicles) == 0

    log("ALL EMPIRICAL TESTS COMPLETED SUCCESSFULLY WITH 100% VERIFICATION PASSED!", "SUCCESS")

if __name__ == "__main__":
    main()
