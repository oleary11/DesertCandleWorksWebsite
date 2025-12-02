import copy
import json
import os
from datetime import datetime
import streamlit as st

# =========================
# Files for persistence
# =========================

SCENTS_FILE = "scents.json"
BLENDS_FILE = "blends.json"
CONTAINERS_FILE = "containers.json"
INVENTORY_FILE = "inventory.json"

# =========================
# Base constants & defaults
# =========================

# Wax info
DEFAULT_WAX_COST_PER_OZ = 157.64 / 720  # $157.64 for 45 lb (720 oz) of wax (no promo)
DEFAULT_WATER_TO_WAX_RATIO = 0.90       # 1 oz water ≈ 0.9 oz wax
DEFAULT_FRAGRANCE_LOAD = 0.08           # 8%

# Base fragrance oil costs per ounce (oil + shipping where given)
BASE_SCENTS = {
    # internal_name: cost_per_oz
    "bonfire_embers":   38.87 / 16,  # $29.04 + 9.83 shipping, 16 oz
    "lavender":         24.71 / 15,
    "leather":          27.63 / 16,
    "white_eucalyptus": 32.20 / 16,
    "sandalwood":       25.91 / 15,
}

# Wick costs per piece, including share of shipping
# 34 total wicks, $7.50 shipping => 7.50 / 34 ≈ 0.2206 per wick extra
SHIPPING_PER_WICK = 7.50 / 34.0
BASE_WICKS = {
    "wood_30mm": 1.25 + SHIPPING_PER_WICK,           # ≈ 1.47
    "wood_20mm": (8.25 / 10) + SHIPPING_PER_WICK,    # ≈ 1.05
    "cdn12":     (7.50 / 10) + SHIPPING_PER_WICK,    # ≈ 0.97
    "cdn16":     (5.00 / 10) + SHIPPING_PER_WICK,    # ≈ 0.72
}


# =========================
# Persistence helpers
# =========================

def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception:
        # If file is corrupted, just fall back to default
        return default


def save_json(path, data):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        st.error(f"Error saving file `{path}`: {e}")


def load_scents_from_file():
    """
    Returns dict of custom scents from scents.json.
    Structure: { "scent_key": cost_per_oz, ... }
    """
    data = load_json(SCENTS_FILE, {})
    # Ensure all values are float
    cleaned = {}
    for k, v in data.items():
        try:
            cleaned[k] = float(v)
        except (ValueError, TypeError):
            continue
    return cleaned


def save_scents_to_file(custom_scents):
    """
    Save only custom scents (not the built-in ones) to file.
    """
    save_json(SCENTS_FILE, custom_scents)


def load_blends_from_file():
    """
    Returns dict of blends.
    Structure:
    {
      "blend_name": {
          "scents": { "scent_key": percentage, ... }
      },
      ...
    }
    """
    data = load_json(BLENDS_FILE, {})
    cleaned = {}
    for name, info in data.items():
        scents = info.get("scents", {})
        # Ensure percentages are floats
        cleaned_scents = {}
        for sk, pct in scents.items():
            try:
                cleaned_scents[sk] = float(pct)
            except (ValueError, TypeError):
                continue
        if cleaned_scents:
            cleaned[name] = {"scents": cleaned_scents}
    return cleaned


def save_blends_to_file(blends):
    save_json(BLENDS_FILE, blends)


def load_containers_from_file():
    """
    Returns dict of containers.
    Structure:
    {
      "container_id": {
          "name": "8oz Amber Jar",
          "capacity_oz": 8.0,
          "capacity_water_oz": 7.5,
          "shape": "Round",
          "supplier": "Supplier Name",
          "cost_per_unit": 2.50,
          "notes": "Optional notes"
      },
      ...
    }
    """
    return load_json(CONTAINERS_FILE, {})


def save_containers_to_file(containers):
    save_json(CONTAINERS_FILE, containers)


def load_inventory_from_file():
    """
    Returns dict of inventory items.
    Structure:
    {
      "item_id": {
          "sku": "DCW-001",
          "product_name": "Boot Leather - 8oz",
          "container_id": "8oz_amber",
          "blend_name": "Boot Leather",
          "production_date": "2025-12-01",
          "batch_number": "B001",
          "quantity": 12,
          "material_cost": 5.25,
          "target_price": 25.00,
          "wick_config": {"wood_30mm": 1},
          "wax_oz": 6.75,
          "fragrance_oz": 0.54,
          "notes": ""
      },
      ...
    }
    """
    return load_json(INVENTORY_FILE, {})


def save_inventory_to_file(inventory):
    save_json(INVENTORY_FILE, inventory)


# =========================
# Session init
# =========================

def init_session_state():
    # Load scents: base + persisted customs
    if "scents" not in st.session_state:
        custom_scents = load_scents_from_file()
        scents = copy.deepcopy(BASE_SCENTS)
        scents.update(custom_scents)  # custom overrides if same key
        st.session_state.scents = scents

    # Track custom scents separately for saving
    if "custom_scents" not in st.session_state:
        # Anything not in BASE_SCENTS is considered custom
        st.session_state.custom_scents = {
            k: v for k, v in st.session_state.scents.items()
            if k not in BASE_SCENTS
        }

    if "wicks" not in st.session_state:
        st.session_state.wicks = copy.deepcopy(BASE_WICKS)

    # Load saved blends
    if "blends" not in st.session_state:
        st.session_state.blends = load_blends_from_file()

    # Load containers
    if "containers" not in st.session_state:
        st.session_state.containers = load_containers_from_file()

    # Load inventory
    if "inventory" not in st.session_state:
        st.session_state.inventory = load_inventory_from_file()


# =========================
# Helper functions
# =========================

def add_custom_scent():
    with st.expander("➕ Add a custom / seasonal scent", expanded=False):
        st.write("Add any new FO by name, bottle size, and total cost (include shipping if you want).")
        name = st.text_input("Scent name (e.g. 'Pumpkin Spice')", key="new_scent_name")
        col1, col2 = st.columns(2)
        with col1:
            bottle_oz = st.number_input("Bottle size (oz)", min_value=0.0, step=1.0, key="new_scent_oz")
        with col2:
            total_cost = st.number_input("Total cost for this bottle ($)", min_value=0.0, step=0.5, key="new_scent_cost")

        if st.button("Add scent to list"):
            if not name.strip():
                st.warning("Please enter a scent name.")
            elif bottle_oz <= 0 or total_cost <= 0:
                st.warning("Bottle size and cost must both be greater than 0.")
            else:
                key = name.strip().lower().replace(" ", "_")
                cost_per_oz = total_cost / bottle_oz
                st.session_state.scents[key] = cost_per_oz
                st.session_state.custom_scents[key] = cost_per_oz
                save_scents_to_file(st.session_state.custom_scents)
                st.success(f"Added scent `{key}` at ${cost_per_oz:.2f}/oz (saved to scents.json).")


def pretty_name(key: str) -> str:
    return key.replace("_", " ").title()


def manage_containers():
    """
    UI for managing container types (bottles, jars, etc.)
    """
    with st.expander("📦 Manage Containers", expanded=False):
        st.write("Add and manage your container types (jars, bottles, etc.).")

        # Add new container
        st.markdown("### Add New Container")
        col1, col2 = st.columns(2)
        with col1:
            container_name = st.text_input("Container name (e.g., '8oz Amber Jar')", key="new_container_name")
            capacity_water_oz = st.number_input("Water capacity at pour level (oz)", min_value=0.0, step=0.1, key="new_container_water_oz")
            supplier = st.text_input("Supplier (optional)", key="new_container_supplier")
        with col2:
            shape = st.selectbox("Shape", options=["Round", "Square", "Hexagonal", "Rectangular", "Other"], key="new_container_shape")
            cost_per_unit = st.number_input("Cost per container ($)", min_value=0.0, step=0.1, key="new_container_cost")
            notes = st.text_area("Notes (optional)", key="new_container_notes", height=60)

        if st.button("Add Container"):
            if not container_name.strip():
                st.warning("Please enter a container name.")
            elif capacity_water_oz <= 0:
                st.warning("Water capacity must be greater than 0.")
            else:
                container_id = container_name.strip().lower().replace(" ", "_")
                st.session_state.containers[container_id] = {
                    "name": container_name.strip(),
                    "capacity_water_oz": capacity_water_oz,
                    "shape": shape,
                    "supplier": supplier.strip() if supplier else "",
                    "cost_per_unit": cost_per_unit,
                    "notes": notes.strip() if notes else ""
                }
                save_containers_to_file(st.session_state.containers)
                st.success(f"Added container '{container_name}' (saved to containers.json).")
                st.rerun()

        # Display existing containers
        if st.session_state.containers:
            st.markdown("### Existing Containers")
            for container_id, info in st.session_state.containers.items():
                with st.container():
                    col_a, col_b, col_c = st.columns([3, 1, 1])
                    with col_a:
                        st.write(f"**{info['name']}**")
                        st.caption(f"{info['capacity_water_oz']:.1f}oz • {info['shape']} • ${info['cost_per_unit']:.2f} each")
                        if info.get('supplier'):
                            st.caption(f"Supplier: {info['supplier']}")
                    with col_b:
                        if st.button("Edit", key=f"edit_container_{container_id}"):
                            st.info("Edit feature coming soon!")
                    with col_c:
                        if st.button("Delete", key=f"del_container_{container_id}"):
                            del st.session_state.containers[container_id]
                            save_containers_to_file(st.session_state.containers)
                            st.success(f"Deleted container '{info['name']}'")
                            st.rerun()
                    st.divider()
        else:
            st.info("No containers added yet. Add your first container above!")


def compute_blend_cost_from_definition(scents_dict, blend_def):
    """
    blend_def: {"scents": { "scent_key": pct, ... }}
    Returns (weighted_cost_per_oz, total_pct, warnings)
    """
    blend_scents = blend_def.get("scents", {})
    total_pct = sum(blend_scents.values())
    warnings = []

    if abs(total_pct - 100.0) > 0.01:
        warnings.append(f"Blend percents total {total_pct:.1f}%, not 100%.")
    # Weighted FO cost per oz
    weighted_cost = 0.0
    for scent_key, pct in blend_scents.items():
        if scent_key not in scents_dict:
            warnings.append(f"Scent `{scent_key}` is not in current scent list.")
            continue
        weight = pct / 100.0
        weighted_cost += weight * scents_dict[scent_key]

    return weighted_cost, total_pct, warnings


def build_new_blend(scents_dict):
    """
    UI to create a new blend (not yet saved).
    Returns: (weighted_cost_per_oz or None, total_pct, blend_scents_dict)
    where blend_scents_dict = { scent_key: pct, ... }
    """
    st.write("Create your fragrance blend with weighted percentages (must total 100%).")

    scent_keys = list(scents_dict.keys())

    num_rows = st.slider("How many scents in this blend?", min_value=1, max_value=4, value=1, key="new_blend_num_rows")
    rows = []
    for i in range(num_rows):
        col1, col2 = st.columns([2, 1])
        with col1:
            scent = st.selectbox(
                f"Scent #{i+1}",
                options=scent_keys,
                format_func=pretty_name,
                key=f"new_blend_scent_{i}"
            )
        with col2:
            pct_default = 100.0 if (i == 0 and num_rows == 1) else 0.0
            pct = st.number_input(
                f"Percent for scent #{i+1}",
                min_value=0.0,
                max_value=100.0,
                value=pct_default,
                step=1.0,
                key=f"new_blend_pct_{i}"
            )
        rows.append((scent, pct))

    # Build dict
    blend_scents = {}
    for scent_key, pct in rows:
        if pct > 0:
            blend_scents[scent_key] = blend_scents.get(scent_key, 0.0) + pct

    total_pct = sum(blend_scents.values())
    if not blend_scents:
        st.error("Add at least one scent with a percentage > 0.")
        return None, total_pct, {}

    if abs(total_pct - 100.0) > 0.01:
        st.error(f"Blend percentages must total 100%. Current total: {total_pct:.1f}%.")
        return None, total_pct, blend_scents

    # Weighted FO cost per oz
    weighted_cost = 0.0
    for scent_key, pct in blend_scents.items():
        weight = pct / 100.0
        weighted_cost += weight * scents_dict[scent_key]

    st.success(f"Blend OK ✅ (Total: {total_pct:.1f}%) • Weighted FO cost: ${weighted_cost:.2f}/oz")
    return weighted_cost, total_pct, blend_scents


def blend_selector(scents_dict):
    """
    UI for selecting either a saved blend or building a new one.
    Returns: (fo_cost_per_oz or None, blend_source_description)
    """
    st.subheader("2️⃣ Scents & Blend")

    add_custom_scent()

    mode = st.radio(
        "How do you want to choose the fragrance blend?",
        options=["Use saved blend", "Create new blend"],
        horizontal=True,
    )

    # --- Use saved blend ---
    if mode == "Use saved blend":
        if not st.session_state.blends:
            st.info("No saved blends yet. Switch to 'Create new blend' to define one.")
            return None, "no_blend"

        blend_names = list(st.session_state.blends.keys())
        selected = st.selectbox("Saved blends", options=blend_names, key="selected_saved_blend")
        blend_def = st.session_state.blends[selected]

        cost, total_pct, warnings = compute_blend_cost_from_definition(scents_dict, blend_def)

        st.write(f"**Blend:** {selected}")
        lines = []
        for sk, pct in blend_def["scents"].items():
            lines.append(f"- {pct:.1f}% {pretty_name(sk)}")
        st.markdown("\n".join(lines))

        if warnings:
            for w in warnings:
                st.warning(w)

        if abs(total_pct - 100.0) <= 0.01 and not warnings:
            st.success(f"Weighted FO cost: **${cost:.2f}/oz** (Total: {total_pct:.1f}%)")
            return cost, f"saved:{selected}"
        else:
            return None, f"saved_invalid:{selected}"

    # --- Create new blend ---
    else:
        cost, total_pct, blend_scents = build_new_blend(scents_dict)

        # Optionally save this blend
        st.markdown("---")
        st.write("💾 **Save this blend for later?**")
        blend_name = st.text_input("Blend name (e.g. 'Leather x Sandalwood – DCW Signature')", key="new_blend_name")

        if st.button("Save blend"):
            if not blend_name.strip():
                st.warning("Please enter a blend name.")
            elif not blend_scents:
                st.warning("Define a valid blend before saving.")
            elif abs(total_pct - 100.0) > 0.01:
                st.warning("Blend must total 100% before saving.")
            else:
                name_key = blend_name.strip()
                st.session_state.blends[name_key] = {"scents": blend_scents}
                save_blends_to_file(st.session_state.blends)
                st.success(f"Saved blend '{name_key}' to blends.json.")

        if cost is not None:
            return cost, "new_blend"
        else:
            return None, "new_blend_invalid"


def choose_wicks(wicks_dict):
    st.subheader("3️⃣ Wicks")

    st.write("Set how many of each wick type you’re using in this candle.")

    total_wick_cost = 0.0
    wick_counts = {}

    cols = st.columns(len(wicks_dict))
    for (name, cost), col in zip(wicks_dict.items(), cols):
        with col:
            count = st.number_input(
                name.replace("_", " ").upper(),
                min_value=0,
                max_value=10,
                step=1,
                value=0,
                key=f"wick_count_{name}"
            )
            wick_counts[name] = count
            total_wick_cost += count * cost
            st.caption(f"${cost:.2f} each")

    if total_wick_cost > 0:
        st.info(f"Total wick cost for this candle: **${total_wick_cost:.2f}**")

    return total_wick_cost, wick_counts


def compute_results(
    water_oz,
    wax_cost_per_oz,
    water_to_wax_ratio,
    fragrance_load,
    fo_cost_per_oz,
    wick_cost
):
    wax_oz = water_oz * water_to_wax_ratio
    fragrance_oz = wax_oz * fragrance_load

    wax_cost = wax_oz * wax_cost_per_oz
    fragrance_cost = fragrance_oz * fo_cost_per_oz

    total_material_cost = wax_cost + fragrance_cost + wick_cost
    cost_per_wax_oz = total_material_cost / wax_oz if wax_oz > 0 else 0.0

    return {
        "wax_oz": wax_oz,
        "fragrance_oz": fragrance_oz,
        "wax_cost": wax_cost,
        "fragrance_cost": fragrance_cost,
        "wick_cost": wick_cost,
        "total_material_cost": total_material_cost,
        "cost_per_wax_oz": cost_per_wax_oz,
    }


def add_to_inventory_form(results, blend_source, wick_counts, water_oz):
    """
    Form to add calculated candle to inventory
    """
    st.markdown("---")
    st.subheader("📦 Add to Inventory")

    with st.expander("💾 Save this candle to inventory", expanded=False):
        if not st.session_state.containers:
            st.warning("⚠️ Please add at least one container type first using 'Manage Containers' above.")
            return

        col1, col2 = st.columns(2)

        with col1:
            sku = st.text_input("SKU / Product Code", placeholder="DCW-001", key="inv_sku")
            product_name = st.text_input("Product Name", placeholder="Boot Leather - 8oz", key="inv_product_name")

            # Container selection
            container_ids = list(st.session_state.containers.keys())
            container_names = [st.session_state.containers[cid]["name"] for cid in container_ids]
            selected_container_idx = st.selectbox(
                "Container Type",
                options=range(len(container_ids)),
                format_func=lambda i: container_names[i],
                key="inv_container"
            )
            selected_container_id = container_ids[selected_container_idx]

            quantity = st.number_input("Initial Quantity", min_value=0, value=1, step=1, key="inv_quantity")

        with col2:
            # Extract blend name from blend_source
            blend_name = ""
            if blend_source.startswith("saved:"):
                blend_name = blend_source.split(":", 1)[1]
            else:
                blend_name = "Custom Blend"

            st.text_input("Blend Name", value=blend_name, key="inv_blend", disabled=True)

            production_date = st.date_input("Production Date", value=datetime.today(), key="inv_prod_date")
            batch_number = st.text_input("Batch Number", placeholder="B001", key="inv_batch")
            target_price = st.number_input("Target/Retail Price ($)", min_value=0.0, value=0.0, step=1.0, key="inv_target_price")

        notes = st.text_area("Notes (optional)", key="inv_notes", height=80)

        # Show profit margin if target price is set
        if target_price > 0:
            container_cost = st.session_state.containers[selected_container_id]["cost_per_unit"]
            total_unit_cost = results["total_material_cost"] + container_cost
            profit = target_price - total_unit_cost
            margin = (profit / target_price * 100) if target_price > 0 else 0

            col_a, col_b, col_c = st.columns(3)
            with col_a:
                st.metric("Material Cost", f"${results['total_material_cost']:.2f}")
            with col_b:
                st.metric("+ Container Cost", f"${container_cost:.2f}")
            with col_c:
                st.metric("= Total Unit Cost", f"${total_unit_cost:.2f}")

            st.success(f"💰 Profit: **${profit:.2f}** per unit ({margin:.1f}% margin)")

        if st.button("💾 Save to Inventory", type="primary"):
            if not sku.strip():
                st.warning("Please enter a SKU/Product Code.")
            elif not product_name.strip():
                st.warning("Please enter a Product Name.")
            else:
                # Generate unique inventory ID
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                item_id = f"{sku.strip().lower().replace(' ', '_')}_{timestamp}"

                # Create inventory item
                inventory_item = {
                    "sku": sku.strip(),
                    "product_name": product_name.strip(),
                    "container_id": selected_container_id,
                    "blend_name": blend_name,
                    "production_date": production_date.strftime("%Y-%m-%d"),
                    "batch_number": batch_number.strip(),
                    "quantity": quantity,
                    "material_cost": results["total_material_cost"],
                    "container_cost": st.session_state.containers[selected_container_id]["cost_per_unit"],
                    "target_price": target_price,
                    "wick_config": wick_counts,
                    "wax_oz": results["wax_oz"],
                    "fragrance_oz": results["fragrance_oz"],
                    "water_oz": water_oz,
                    "notes": notes.strip() if notes else ""
                }

                st.session_state.inventory[item_id] = inventory_item
                save_inventory_to_file(st.session_state.inventory)
                st.success(f"✅ Added '{product_name}' to inventory! (saved to inventory.json)")
                st.balloons()


# =========================
# Streamlit App
# =========================

def main():
    st.set_page_config(
        page_title="Desert Candle Works Cost Calculator",
        page_icon="🕯️",
        layout="centered",
    )

    # Light custom styling
    st.markdown(
        """
        <style>
        .main {
            background: radial-gradient(circle at top left, #f7f0ff 0, #fefcf8 40%, #f9f5ff 100%);
        }
        .stApp {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .dcw-card {
            padding: 1.2rem 1.4rem;
            border-radius: 1.2rem;
            background-color: rgba(255,255,255,0.9);
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
            border: 1px solid rgba(148, 163, 184, 0.25);
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

    init_session_state()

    st.title("🕯️ Desert Candle Works – Inventory Management")
    st.caption("Calculate costs and manage your candle inventory.")

    # Navigation tabs
    tab1, tab2 = st.tabs(["📊 Cost Calculator", "📦 Inventory"])

    # Store current tab in session state
    if "current_tab" not in st.session_state:
        st.session_state.current_tab = "calculator"

    # Sidebar – global settings
    with st.sidebar:
        st.header("⚙️ Settings")
        st.write("Adjust global assumptions if needed.")

        wax_cost_per_oz = st.number_input(
            "Wax cost per oz ($)",
            min_value=0.0,
            value=float(DEFAULT_WAX_COST_PER_OZ),
            step=0.01,
        )
        water_to_wax_ratio = st.number_input(
            "Water → Wax ratio",
            min_value=0.5,
            max_value=1.2,
            value=float(DEFAULT_WATER_TO_WAX_RATIO),
            step=0.01,
            help="How many oz of wax fit per oz of water in your jars (default ~0.90).",
        )
        fragrance_load = st.slider(
            "Fragrance load (%)",
            min_value=4,
            max_value=12,
            value=int(DEFAULT_FRAGRANCE_LOAD * 100),
            step=1,
            help="Percentage of FO by weight (8% is your current standard).",
        ) / 100.0

        st.divider()
        st.subheader("Scents in system")
        for key, cost in st.session_state.scents.items():
            st.caption(f"• {pretty_name(key)} — ${cost:.2f}/oz")

        if st.session_state.blends:
            st.divider()
            st.subheader("Saved blends")
            for name, info in st.session_state.blends.items():
                parts = ", ".join(
                    f"{pct:.0f}% {pretty_name(sk)}"
                    for sk, pct in info["scents"].items()
                )
                st.caption(f"• {name}: {parts}")

    # TAB 1: Cost Calculator
    with tab1:
        # Container management
        manage_containers()

        # Main content card
        with st.container():
            st.markdown('<div class="dcw-card">', unsafe_allow_html=True)

            # 1) Jar & recipe setup
            st.subheader("1️⃣ Jar & Recipe")

        col_a, col_b = st.columns(2)
        with col_a:
            water_oz = st.number_input(
                "Jar capacity at pour level (oz of WATER)",
                min_value=0.0,
                step=0.1,
                help="Fill jar with water to your typical pour level, then weigh/measure in oz.",
            )
        with col_b:
            st.metric("Fragrance load", f"{fragrance_load*100:.1f}%")

        # 2) Scents & blend (with saved blends + new blend option)
        fo_cost_per_oz, blend_source = blend_selector(st.session_state.scents)

        # 3) Wicks
        wick_cost, wick_counts = choose_wicks(st.session_state.wicks)

        # 4) Results
        st.subheader("4️⃣ Results")

        if water_oz <= 0:
            st.warning("Enter a jar capacity in oz to see results.")
        elif fo_cost_per_oz is None:
            st.warning("Select or define a valid fragrance blend to see results.")
        else:
            results = compute_results(
                water_oz=water_oz,
                wax_cost_per_oz=wax_cost_per_oz,
                water_to_wax_ratio=water_to_wax_ratio,
                fragrance_load=fragrance_load,
                fo_cost_per_oz=fo_cost_per_oz,
                wick_cost=wick_cost,
            )

            wax_oz = results["wax_oz"]
            fragrance_oz = results["fragrance_oz"]
            total_cost = results["total_material_cost"]

            c1, c2, c3 = st.columns(3)
            with c1:
                st.metric("Wax needed", f"{wax_oz:.2f} oz")
            with c2:
                st.metric("Fragrance needed", f"{fragrance_oz:.2f} oz")
            with c3:
                st.metric("Total material cost", f"${total_cost:.2f}")

            st.markdown("#### Cost breakdown")
            col_x, col_y = st.columns(2)

            with col_x:
                st.write("**Wax**")
                st.write(f"- Cost per oz: `${wax_cost_per_oz:.3f}`")
                st.write(f"- Total: `${results['wax_cost']:.2f}`")

                st.write("**Fragrance**")
                st.write(f"- FO cost per oz (blend): `${fo_cost_per_oz:.2f}`")
                st.write(f"- Total: `${results['fragrance_cost']:.2f}`")

            with col_y:
                st.write("**Wicks**")
                if wick_cost > 0:
                    for name, count in wick_counts.items():
                        if count > 0:
                            each = st.session_state.wicks[name]
                            st.write(
                                f"- {count} × {name.replace('_',' ').upper()} @ ${each:.2f} = ${each*count:.2f}"
                            )
                else:
                    st.write("- No wicks selected")

                st.write("**Totals**")
                st.write(f"- Total material cost: `${results['total_material_cost']:.2f}`")
                st.write(f"- Cost per wax oz: `${results['cost_per_wax_oz']:.3f}`")

            # Add to inventory form
            add_to_inventory_form(results, blend_source, wick_counts, water_oz)

            st.markdown("</div>", unsafe_allow_html=True)

    # TAB 2: Inventory
    with tab2:
        st.subheader("📦 Inventory Management")

        if not st.session_state.inventory:
            st.info("📦 No items in inventory yet. Use the Cost Calculator tab to add your first candle!")
        else:
            # Summary metrics
            total_items = len(st.session_state.inventory)
            total_quantity = sum(item["quantity"] for item in st.session_state.inventory.values())
            total_value = sum(
                item["quantity"] * (item["material_cost"] + item.get("container_cost", 0))
                for item in st.session_state.inventory.values()
            )

            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total Products", total_items)
            with col2:
                st.metric("Total Units", total_quantity)
            with col3:
                st.metric("Inventory Value", f"${total_value:.2f}")

            st.markdown("---")

            # Search and filter
            search = st.text_input("🔍 Search by product name or SKU", key="inv_search")

            # Display inventory items
            for item_id, item in st.session_state.inventory.items():
                # Filter by search
                if search and search.lower() not in item["product_name"].lower() and search.lower() not in item["sku"].lower():
                    continue

                with st.expander(f"**{item['product_name']}** (SKU: {item['sku']})", expanded=False):
                    col_a, col_b = st.columns(2)

                    with col_a:
                        st.write("**Product Details**")
                        st.write(f"- Blend: {item['blend_name']}")
                        container = st.session_state.containers.get(item['container_id'], {})
                        container_name = container.get('name', 'Unknown')
                        st.write(f"- Container: {container_name}")
                        st.write(f"- Production Date: {item['production_date']}")
                        if item.get('batch_number'):
                            st.write(f"- Batch: {item['batch_number']}")

                        st.write("\n**Recipe**")
                        st.write(f"- Wax: {item['wax_oz']:.2f} oz")
                        st.write(f"- Fragrance: {item['fragrance_oz']:.2f} oz")

                    with col_b:
                        st.write("**Inventory**")
                        st.write(f"- Quantity on hand: **{item['quantity']}**")

                        st.write("\n**Financials**")
                        material_cost = item['material_cost']
                        container_cost = item.get('container_cost', 0)
                        total_cost = material_cost + container_cost
                        st.write(f"- Material cost: ${material_cost:.2f}")
                        st.write(f"- Container cost: ${container_cost:.2f}")
                        st.write(f"- Total unit cost: **${total_cost:.2f}**")

                        if item.get('target_price', 0) > 0:
                            profit = item['target_price'] - total_cost
                            margin = (profit / item['target_price'] * 100) if item['target_price'] > 0 else 0
                            st.write(f"- Target price: ${item['target_price']:.2f}")
                            st.write(f"- Profit per unit: **${profit:.2f}** ({margin:.1f}%)")

                    if item.get('notes'):
                        st.write(f"\n**Notes:** {item['notes']}")

                    # Action buttons
                    st.markdown("---")
                    col_x, col_y, col_z = st.columns(3)

                    with col_x:
                        # Adjust quantity
                        new_qty = st.number_input(
                            "Update quantity",
                            min_value=0,
                            value=item['quantity'],
                            key=f"qty_{item_id}"
                        )
                        if st.button("Update", key=f"update_{item_id}"):
                            st.session_state.inventory[item_id]['quantity'] = new_qty
                            save_inventory_to_file(st.session_state.inventory)
                            st.success(f"Updated quantity to {new_qty}")
                            st.rerun()

                    with col_z:
                        if st.button("🗑️ Delete", key=f"delete_{item_id}"):
                            del st.session_state.inventory[item_id]
                            save_inventory_to_file(st.session_state.inventory)
                            st.success("Item deleted")
                            st.rerun()


if __name__ == "__main__":
    main()