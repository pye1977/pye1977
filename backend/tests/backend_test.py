"""RIVITED Solutions — Backend regression suite (pytest)."""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://media-supply-chain.preview.emergentagent.com",
).rstrip("/")

# Read frontend/.env if env var not present
if "REACT_APP_BACKEND_URL" not in os.environ:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except FileNotFoundError:
        pass

API = f"{BASE_URL}/api"

ADMIN = ("admin@rivited.io", "rivited2026")
PRODUCER = ("producer@rivited.io", "demo1234")
INVESTOR = ("investor@rivited.io", "demo1234")
DISTRIBUTOR = ("distributor@rivited.io", "demo1234")


# ---------------- Fixtures ----------------
def _session_for(email: str, password: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_s() -> requests.Session:
    return _session_for(*ADMIN)


@pytest.fixture(scope="module")
def producer_s() -> requests.Session:
    return _session_for(*PRODUCER)


@pytest.fixture(scope="module")
def investor_s() -> requests.Session:
    return _session_for(*INVESTOR)


@pytest.fixture(scope="module")
def distributor_s() -> requests.Session:
    return _session_for(*DISTRIBUTOR)


# ---------------- Health & Auth ----------------
class TestHealthAndAuth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"

    def test_login_admin_sets_cookies(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["email"] == ADMIN[0]
        assert body["user"]["role"] == "admin"
        # Cookies set
        cookie_names = {c.name for c in s.cookies}
        assert "access_token" in cookie_names
        assert "refresh_token" in cookie_names

    @pytest.mark.parametrize("email,role", [
        (PRODUCER[0], "producer"),
        (INVESTOR[0], "investor"),
        (DISTRIBUTOR[0], "distributor"),
    ])
    def test_login_demo_users(self, email, role):
        r = requests.post(
            f"{API}/auth/login",
            json={"email": email, "password": "demo1234"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == role

    def test_login_invalid_password(self):
        r = requests.post(
            f"{API}/auth/login",
            json={"email": ADMIN[0], "password": "wrong"},
            timeout=20,
        )
        assert r.status_code == 401

    def test_register_new_user_and_logout(self):
        s = requests.Session()
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(
            f"{API}/auth/register",
            json={
                "email": email,
                "password": "demo1234",
                "name": "TEST User",
                "role": "investor",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["email"] == email
        assert body["user"]["role"] == "investor"

        # me
        me = s.get(f"{API}/auth/me", timeout=15)
        assert me.status_code == 200
        assert me.json()["email"] == email

        # logout
        lo = s.post(f"{API}/auth/logout", timeout=15)
        assert lo.status_code == 200

        # me after logout (use a fresh session without cookies)
        s2 = requests.Session()
        me2 = s2.get(f"{API}/auth/me", timeout=15)
        assert me2.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_role_enforcement_non_producer_cannot_create_spv(self, investor_s):
        r = investor_s.post(
            f"{API}/spvs",
            json={
                "name": "TEST_BLOCKED",
                "description": "should be blocked",
                "type": "vertical_drama",
                "territory": "US",
                "total_budget": 100000,
                "minimum_investment": 100,
                "target_irr": 12,
                "genre": "drama",
            },
            timeout=20,
        )
        assert r.status_code == 403


# ---------------- SPVs ----------------
class TestSPV:
    spv_id: str = ""

    def test_demo_seed_spvs_exist(self, producer_s):
        r = producer_s.get(f"{API}/spvs", timeout=15)
        assert r.status_code == 200
        names = {s["name"] for s in r.json()}
        for expected in ["Saturn Falls", "Neon Mahal", "Black Lacquer"]:
            assert expected in names, f"Missing seeded SPV: {expected}"

    def test_create_spv_as_producer(self, producer_s):
        payload = {
            "name": f"TEST_SPV_{uuid.uuid4().hex[:6]}",
            "description": "Test SPV",
            "type": "vertical_drama",
            "territory": "US",
            "total_budget": 500000,
            "minimum_investment": 100,
            "target_irr": 18,
            "genre": "thriller",
            "episode_count": 12,
        }
        r = producer_s.post(f"{API}/spvs", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == payload["name"]
        assert data["producer_id"]
        TestSPV.spv_id = data["id"]

        # GET to verify persistence
        g = producer_s.get(f"{API}/spvs/{TestSPV.spv_id}", timeout=15)
        assert g.status_code == 200
        assert g.json()["name"] == payload["name"]

        # Producer's cap-table seed entry exists
        ct = producer_s.get(f"{API}/spvs/{TestSPV.spv_id}/cap-table", timeout=15)
        assert ct.status_code == 200
        entries = ct.json()
        assert len(entries) >= 1
        assert any(e["stakeholder_type"] == "producer" for e in entries)

    def test_list_spvs_filters(self, producer_s, investor_s):
        r = producer_s.get(f"{API}/spvs?mine=true", timeout=15)
        assert r.status_code == 200
        assert all(s["producer_id"] for s in r.json())

        r2 = investor_s.get(f"{API}/spvs?open_for_investment=true", timeout=15)
        assert r2.status_code == 200
        assert all(s.get("open_for_investment") for s in r2.json())

    def test_patch_spv(self, producer_s):
        assert TestSPV.spv_id
        r = producer_s.patch(
            f"{API}/spvs/{TestSPV.spv_id}",
            json={"open_for_investment": False, "target_irr": 22},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["open_for_investment"] is False
        assert d["target_irr"] == 22
        # re-open for investment for later investment test
        r2 = producer_s.patch(
            f"{API}/spvs/{TestSPV.spv_id}",
            json={"open_for_investment": True},
            timeout=20,
        )
        assert r2.status_code == 200
        assert r2.json()["open_for_investment"] is True


# ---------------- Cap Table & Waterfall ----------------
class TestCapTableWaterfall:
    def test_cap_table_crud_and_waterfall_execute(self, producer_s):
        assert TestSPV.spv_id, "Need SPV from earlier test"
        spv_id = TestSPV.spv_id

        # Add an extra cap table entry
        r = producer_s.post(
            f"{API}/spvs/{spv_id}/cap-table",
            json={
                "stakeholder_name": "TEST_Writer",
                "stakeholder_type": "writer",
                "equity_percentage": 5.0,
                "investment_amount": 0.0,
                "role": "Writer",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        entry_id = r.json()["id"]

        ct = producer_s.get(f"{API}/spvs/{spv_id}/cap-table", timeout=15).json()
        assert any(e["id"] == entry_id for e in ct)

        # Add waterfall tiers
        for tier in [
            {"tier": 1, "name": "Recoupment", "percentage": 100, "cap_amount": 50000},
            {"tier": 2, "name": "Producer Fee", "percentage": 20},
            {"tier": 3, "name": "Equity Investors", "percentage": 80},
        ]:
            rr = producer_s.post(
                f"{API}/spvs/{spv_id}/waterfall", json=tier, timeout=20
            )
            assert rr.status_code == 200, rr.text

        wt = producer_s.get(f"{API}/spvs/{spv_id}/waterfall", timeout=15).json()
        assert len(wt) >= 3

        # Execute waterfall
        exec_r = producer_s.post(
            f"{API}/spvs/{spv_id}/waterfall/execute",
            json={"revenue_amount": 100000, "revenue_source": "test"},
            timeout=30,
        )
        assert exec_r.status_code == 200, exec_r.text
        body = exec_r.json()
        assert body["total_distributed"] > 0
        assert isinstance(body["distributions"], list)
        assert len(body["distributions"]) > 0

        # Payouts persisted
        pay = producer_s.get(f"{API}/spvs/{spv_id}/payouts", timeout=15)
        assert pay.status_code == 200
        assert len(pay.json()) > 0

        # Delete cap entry
        d = producer_s.delete(
            f"{API}/spvs/{spv_id}/cap-table/{entry_id}", timeout=15
        )
        assert d.status_code == 200


# ---------------- Rights ----------------
class TestRights:
    def test_chain_of_title(self, producer_s):
        assert TestSPV.spv_id
        spv_id = TestSPV.spv_id
        # mint 2 rights
        r1 = producer_s.post(
            f"{API}/spvs/{spv_id}/rights",
            json={
                "type": "distribution",
                "territory": "US",
                "owner_name": "TEST_Distributor_1",
                "duration_years": 5,
                "royalty_percentage": 25.0,
            },
            timeout=20,
        )
        assert r1.status_code == 200, r1.text
        right1 = r1.json()
        assert right1["chain_hash"]
        assert right1["parent_hash"] is None  # first right for this SPV

        r2 = producer_s.post(
            f"{API}/spvs/{spv_id}/rights",
            json={
                "type": "streaming",
                "territory": "EU",
                "owner_name": "TEST_Streamer",
                "duration_years": 3,
                "royalty_percentage": 30.0,
            },
            timeout=20,
        )
        assert r2.status_code == 200
        right2 = r2.json()
        assert right2["parent_hash"] == right1["chain_hash"]

        # list
        lst = producer_s.get(f"{API}/spvs/{spv_id}/rights", timeout=15).json()
        assert len(lst) >= 2

    def test_seeded_saturn_falls_rights(self, producer_s):
        spvs = producer_s.get(f"{API}/spvs", timeout=15).json()
        saturn = next((s for s in spvs if s["name"] == "Saturn Falls"), None)
        assert saturn is not None
        rights = producer_s.get(f"{API}/spvs/{saturn['id']}/rights", timeout=15).json()
        assert len(rights) >= 3  # seed expected ~4


# ---------------- Audit ----------------
class TestAudit:
    def test_audit_events_and_stats(self, producer_s):
        r = producer_s.get(f"{API}/audit/events?limit=20", timeout=15)
        assert r.status_code == 200
        events = r.json()
        assert len(events) > 0
        # Has chain fields
        e0 = events[0]
        for k in ("block_number", "block_hash", "previous_hash", "event_type"):
            assert k in e0, f"Missing key {k} in audit event"

        stats = producer_s.get(f"{API}/audit/stats", timeout=15)
        assert stats.status_code == 200
        s = stats.json()
        assert s["total_blocks"] > 0
        assert s["latest_hash"]

        # filter by spv_id
        if TestSPV.spv_id:
            r2 = producer_s.get(
                f"{API}/audit/events?spv_id={TestSPV.spv_id}", timeout=15
            )
            assert r2.status_code == 200
            for ev in r2.json():
                assert ev.get("spv_id") == TestSPV.spv_id


# ---------------- Investments ----------------
class TestInvestments:
    def test_investor_checkout(self, investor_s, producer_s):
        # Find an open SPV (use seeded one)
        spvs = producer_s.get(
            f"{API}/spvs?open_for_investment=true", timeout=15
        ).json()
        assert spvs, "Need at least one open SPV"
        spv = spvs[0]

        # Below minimum
        r_low = investor_s.post(
            f"{API}/investments/checkout",
            json={
                "spv_id": spv["id"],
                "amount": 1,
                "origin_url": BASE_URL,
            },
            timeout=20,
        )
        assert r_low.status_code == 400

        # Valid
        r = investor_s.post(
            f"{API}/investments/checkout",
            json={
                "spv_id": spv["id"],
                "amount": max(spv["minimum_investment"], 100),
                "origin_url": BASE_URL,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("url")
        assert body.get("session_id")

        # Status endpoint
        st = investor_s.get(f"{API}/payments/status/{body['session_id']}", timeout=30)
        assert st.status_code == 200
        assert st.json()["payment_status"] in {"initiated", "unpaid", "paid", "open", "no_payment_required"}

    def test_investments_mine(self, investor_s):
        r = investor_s.get(f"{API}/investments/mine", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Each has payouts_received field
        for inv in data:
            assert "payouts_received" in inv

    def test_checkout_rejects_when_not_open(self, investor_s, producer_s):
        # Create a new closed SPV
        c = producer_s.post(
            f"{API}/spvs",
            json={
                "name": f"TEST_CLOSED_{uuid.uuid4().hex[:6]}",
                "description": "closed",
                "type": "feature",
                "territory": "US",
                "total_budget": 200000,
                "minimum_investment": 100,
                "target_irr": 10,
                "genre": "drama",
            },
            timeout=20,
        )
        assert c.status_code == 200
        sid = c.json()["id"]
        producer_s.patch(f"{API}/spvs/{sid}", json={"open_for_investment": False}, timeout=15)

        r = investor_s.post(
            f"{API}/investments/checkout",
            json={"spv_id": sid, "amount": 500, "origin_url": BASE_URL},
            timeout=20,
        )
        assert r.status_code == 400


# ---------------- Episodes ----------------
class TestEpisodes:
    def test_list_episodes(self, investor_s):
        r = investor_s.get(f"{API}/episodes", timeout=15)
        assert r.status_code == 200
        eps = r.json()
        assert len(eps) >= 5  # seed expected ~10
        for e in eps:
            assert "unlocked" in e

    def test_create_episode_as_producer_and_filter(self, producer_s):
        assert TestSPV.spv_id
        spv_id = TestSPV.spv_id
        r = producer_s.post(
            f"{API}/episodes",
            json={
                "spv_id": spv_id,
                "series_title": "TEST_Series",
                "episode_number": 1,
                "title": "TEST Pilot",
                "duration_seconds": 600,
                "unlock_price_usd": 0,
                "thumbnail_url": "",
                "description": "free test ep",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        ep = r.json()

        # filter
        f = producer_s.get(f"{API}/episodes?spv_id={spv_id}", timeout=15)
        assert f.status_code == 200
        assert any(e["id"] == ep["id"] for e in f.json())

    def test_free_episode_unlock(self, investor_s):
        # find a free episode (or use the seeded ones; some may be priced)
        eps = investor_s.get(f"{API}/episodes", timeout=15).json()
        free = next((e for e in eps if e["unlock_price_usd"] == 0), None)
        assert free is not None, "No free episode found"
        r = investor_s.post(
            f"{API}/episodes/unlock",
            json={"episode_id": free["id"], "origin_url": BASE_URL},
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json()["free"] is True

    def test_paid_episode_unlock_creates_session(self, investor_s):
        eps = investor_s.get(f"{API}/episodes", timeout=15).json()
        paid = next((e for e in eps if e["unlock_price_usd"] > 0), None)
        if not paid:
            pytest.skip("No paid episode seeded")
        r = investor_s.post(
            f"{API}/episodes/unlock",
            json={"episode_id": paid["id"], "origin_url": BASE_URL},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["free"] is False
        assert body.get("url")


# ---------------- Vendors (AI risk scoring) ----------------
class TestVendors:
    def test_list_seeded_vendors(self, producer_s):
        r = producer_s.get(f"{API}/vendors", timeout=15)
        assert r.status_code == 200
        v = r.json()
        assert len(v) >= 3  # seed expected ~4

    def test_create_vendor_with_ai_scoring(self, producer_s):
        r = producer_s.post(
            f"{API}/vendors",
            json={
                "name": f"TEST_Vendor_{uuid.uuid4().hex[:6]}",
                "role": "vfx",
                "territory": "US",
                "delivery_history": 8,
                "blockchain_attested": False,
                "description": "VFX house",
            },
            timeout=60,  # AI call
        )
        assert r.status_code == 200, r.text
        v = r.json()
        assert 0 <= v["risk_score"] <= 100
        assert v["risk_label"] in {"low", "moderate", "elevated", "high"}


# ---------------- AI endpoints (real Claude calls) ----------------
class TestAI:
    @pytest.fixture(autouse=True)
    def _slow_down(self):
        # Light throttle between heavy AI calls
        yield
        time.sleep(0.5)

    def test_budget_forecast(self, producer_s):
        r = producer_s.post(
            f"{API}/ai/budget-forecast",
            json={
                "production_type": "vertical_drama",
                "territory": "US",
                "genre": "thriller",
                "episode_count": 12,
                "target_quality": "premium",
                "notes": "fast-turnaround",
            },
            timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total_usd" in data
        assert "line_items" in data
        assert "narrative" in data

    def test_deal_memo(self, producer_s):
        spvs = producer_s.get(f"{API}/spvs", timeout=15).json()
        sid = spvs[0]["id"]
        r = producer_s.post(
            f"{API}/ai/deal-memo", json={"spv_id": sid}, timeout=120
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert any(k in data for k in ("memo", "memo_markdown", "markdown"))

    def test_greenlight(self, producer_s):
        spvs = producer_s.get(f"{API}/spvs", timeout=15).json()
        sid = spvs[0]["id"]
        r = producer_s.post(
            f"{API}/ai/greenlight", json={"spv_id": sid}, timeout=120
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "score" in d
        assert "verdict" in d

    def test_rights_conflict(self, producer_s):
        spvs = producer_s.get(f"{API}/spvs", timeout=15).json()
        saturn = next((s for s in spvs if s["name"] == "Saturn Falls"), spvs[0])
        r = producer_s.post(
            f"{API}/ai/rights-conflict",
            json={"spv_id": saturn["id"]},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "clearance_score" in d
