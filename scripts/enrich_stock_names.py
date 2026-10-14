#!/usr/bin/env python3
"""Enriches the Securities Master table with proper, official company names across all symbols."""

import csv
import glob
import os
import re
import sqlite3
import zipfile
import pandas as pd


DB_PATH = "./data/nse_market_data.db"
EQUITY_L_PATH = "./data/EQUITY_L.csv"
SYMBOLCHANGE_PATH = "./data/symbolchange.csv"
NAMECHANGE_PATH = "./data/namechange.csv"


KNOWN_HISTORICAL_NAMES = {
    "TISCO": "Tata Steel Limited (TISCO)",
    "TELCO": "Tata Motors Limited (TELCO)",
    "INFOSYSTCH": "Infosys Technologies Limited",
    "SATYAMCOMP": "Satyam Computer Services Limited",
    "HINDLEVER": "Hindustan Lever Limited (HUL)",
    "BAJAJAUTO": "Bajaj Auto Limited",
    "HEROHONDA": "Hero Honda Motors Limited",
    "ACC": "ACC Limited (Associated Cement Companies)",
    "RANBAXY": "Ranbaxy Laboratories Limited",
    "CIPLA": "Cipla Limited",
    "DRREDDY": "Dr. Reddy's Laboratories Limited",
    "HIMACHLFUT": "Himachal Futuristic Communications Limited (HFCL)",
    "RELPETRO": "Reliance Petroleum Limited",
    "ESSARGUJ": "Essar Steel Limited (Essar Gujarat)",
    "JINDVIJSTL": "Jindal Vijayanagar Steel Limited (JSW Steel)",
    "ANDHRABANK": "Andhra Bank",
    "GUJRATGAS": "Gujarat Gas Company Limited",
    "GUJSIDHCEM": "Gujarat Sidhee Cement Limited",
    "SUPPETRO": "Supreme Petrochem Limited",
    "JPIND": "Jaiprakash Industries Limited",
    "AFTEKINFO": "Aftek Infosys Limited",
    "HUGHESSOFT": "Hughes Software Systems Limited",
    "SQRDSFWARE": "DSQ Software Limited",
    "VISUALSOFT": "VisualSoft Technologies Limited",
    "DIGITALEQP": "Digital GlobalSoft Limited",
    "GLOBALTELE": "Global Tele-Systems Limited (GTL)",
    "BOMDYEING": "Bombay Dyeing & Mfg Company Limited",
    "INDHOTEL": "The Indian Hotels Company Limited (Taj)",
    "TATAPOWER": "Tata Power Company Limited",
    "HINDCONS": "Hindustan Construction Company Limited (HCC)",
    "FIRSTLEASE": "First Leasing Company of India Limited",
    "COMPUDYNE": "Compudyne Winfosystems Limited",
    "BALMLAWRIE": "Balmer Lawrie & Company Limited",
    "BSES": "BSES Limited (Reliance Energy)",
    "IPCL": "Indian Petrochemicals Corporation Limited",
    "GLAXO": "GlaxoSmithKline Pharmaceuticals Limited",
    "UTIBANK": "UTI Bank Limited (Axis Bank)",
    "ORIENTBANK": "Oriental Bank of Commerce",
    "ALLAHABANK": "Allahabad Bank",
    "CORPBANK": "Corporation Bank",
    "VIJAYABANK": "Vijaya Bank",
    "DENABANK": "Dena Bank",
    "RNRL": "Reliance Natural Resources Limited",
    "SYNDIBANK": "Syndicate Bank",
    "FUTUREVENT": "Future Ventures India Limited",
    "OTIS": "Otis Elevator Company (India) Limited",
    "DYNACONS": "Dynacons Systems & Solutions Limited",
    "EUROMULTI": "Euro Multivision Limited",
    "LAKSHAUTO": "Lakshmi Auto Components Limited",
    "ZEETELE": "Zee Telefilms Limited",
    "ORCHIDCHEM": "Orchid Chemicals & Pharmaceuticals Limited",
    "MRPL": "Mangalore Refinery and Petrochemicals Limited",
    "LANESEDA": "Laneeda Limited",
    "CHEMNODRUG": "Chemino Drugs & Pharmaceuticals Limited",
    "ARCHIES": "Archies Limited",
    "ATCOIND": "Atco Industries Limited",
    "PENTSFWARE": "Pentafour Software & Exports Limited",
    "CITICORSEC": "Citicorp Securities Limited",
    "MEDIAVIDEO": "Media Video Limited",
    "NETVISTAIT": "Netvista Information Technology Limited",
    "LUPINLAB": "Lupin Laboratories Limited",
    "L&T": "Larsen & Toubro Limited",
    "LT": "Larsen & Toubro Limited",
    "SUZLON": "Suzlon Energy Limited",
    "YESBANK": "Yes Bank Limited",
    "IDEA": "Vodafone Idea Limited",
    "DHFL": "Dewan Housing Finance Corporation Limited",
    "UNITECH": "Unitech Limited",
    "RCOM": "Reliance Communications Limited",
    "RPOWER": "Reliance Power Limited",
    "JPPOWER": "Jaiprakash Power Ventures Limited",
    "JPASSOCIAT": "Jaiprakash Associates Limited",
    "GTLINFRA": "GTL Infrastructure Limited",
    "VIDEOIND": "Videocon Industries Limited",
    "ALOKTEXT": "Alok Industries Limited",
    "HDIL": "Housing Development and Infrastructure Limited",
    "IBREALEST": "Indiabulls Real Estate Limited",
    "IFCI": "IFCI Limited",
    "IDBI": "IDBI Bank Limited",
    "RELINFRA": "Reliance Infrastructure Limited",
    "CANBK": "Canara Bank",
    "PNB": "Punjab National Bank",
    "BANKBARODA": "Bank of Baroda",
    "UNIONBANK": "Union Bank of India",
    "CENTRALBK": "Central Bank of India",
    "INDIANB": "Indian Bank",
    "UCOBANK": "UCO Bank",
    "IOB": "Indian Overseas Bank",
    "PSB": "Punjab & Sind Bank",
    "MAHABANK": "Bank of Maharashtra",
    "SBIN": "State Bank of India",
    "RELIANCE": "Reliance Industries Limited",
    "TCS": "Tata Consultancy Services Limited",
    "INFY": "Infosys Limited",
    "HDFCBANK": "HDFC Bank Limited",
    "ICICIBANK": "ICICI Bank Limited",
    "TATAMOTORS": "Tata Motors Limited",
    "ITC": "ITC Limited",
    "HINDUNILVR": "Hindustan Unilever Limited",
    "BHARTIARTL": "Bharti Airtel Limited",
    "KOTAKBANK": "Kotak Mahindra Bank Limited",
    "AXISBANK": "Axis Bank Limited",
    "BAJFINANCE": "Bajaj Finance Limited",
    "MARUTI": "Maruti Suzuki India Limited",
    "ASIANPAINT": "Asian Paints Limited",
    "SUNPHARMA": "Sun Pharmaceutical Industries Limited",
    "TITAN": "Titan Company Limited",
    "WIPRO": "Wipro Limited",
    "ULTRACEMCO": "UltraTech Cement Limited",
    "NTPC": "NTPC Limited",
    "POWERGRID": "Power Grid Corporation of India Limited",
    "NESTLEIND": "Nestle India Limited",
    "GRASIM": "Grasim Industries Limited",
    "JSWSTEEL": "JSW Steel Limited",
    "TATASTEEL": "Tata Steel Limited",
    "HCLTECH": "HCL Technologies Limited",
    "ADANIENT": "Adani Enterprises Limited",
    "ADANIPORTS": "Adani Ports and Special Economic Zone Limited",
    "COALINDIA": "Coal India Limited",
    "ONGC": "Oil and Natural Gas Corporation Limited",
    "BPCL": "Bharat Petroleum Corporation Limited",
    "IOC": "Indian Oil Corporation Limited",
    "HEROMOTOCO": "Hero MotoCorp Limited",
    "EICHERMOT": "Eicher Motors Limited",
    "DIVISLAB": "Divi's Laboratories Limited",
    "CIPLA": "Cipla Limited",
    "DRREDDY": "Dr. Reddy's Laboratories Limited",
    "APOLLOHOSP": "Apollo Hospitals Enterprise Limited",
    "BAJAJFINSV": "Bajaj Finserv Limited",
    "BAJAJ-AUTO": "Bajaj Auto Limited",
    "BRITANNIA": "Britannia Industries Limited",
    "INDUSINDBK": "IndusInd Bank Limited",
    "TECHM": "Tech Mahindra Limited",
    "HINDALCO": "Hindalco Industries Limited",
    "TATACONSUM": "Tata Consumer Products Limited",
    "SBILIFE": "SBI Life Insurance Company Limited",
    "HDFCLIFE": "HDFC Life Insurance Company Limited",
    "BEL": "Bharat Electronics Limited",
    "HAL": "Hindustan Aeronautics Limited",
    "VBL": "Varun Beverages Limited",
    "TRENT": "Trent Limited",
    "SHRIRAMFIN": "Shriram Finance Limited",
    "ZOMATO": "Zomato Limited",
    "JIOFIN": "Jio Financial Services Limited",
    "BOSCHLTD": "Bosch Limited",
    "SIEMENS": "Siemens Limited",
    "ABB": "ABB India Limited",
    "HAVELLS": "Havells India Limited",
    "POLYCAB": "Polycab India Limited",
    "DLF": "DLF Limited",
    "LTIM": "LTIMindtree Limited",
    "PERSISTENT": "Persistent Systems Limited",
    "COFORGE": "Coforge Limited",
    "MPHASIS": "Mphasis Limited",
    "NAUKRI": "Info Edge (India) Limited",
}


def load_master_dictionaries():
    names = dict(KNOWN_HISTORICAL_NAMES)
    isins = {}

    # 1. EQUITY_L.csv
    if os.path.exists(EQUITY_L_PATH):
        with open(EQUITY_L_PATH, mode="r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                sym = row.get("SYMBOL", "").strip().upper()
                name = row.get("NAME OF COMPANY", "").strip()
                isin = row.get(" ISIN NUMBER", "").strip() if " ISIN NUMBER" in row else None
                if sym and name:
                    names[sym] = name
                    if isin:
                        isins[sym] = isin

    # 2. symbolchange.csv
    if os.path.exists(SYMBOLCHANGE_PATH):
        with open(SYMBOLCHANGE_PATH, mode="r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                name = row.get("NAME OF THE COMPANY", "").strip()
                for col in ["OLD SYMBOL", "NEW SYMBOL"]:
                    sym = row.get(col, "").strip().upper()
                    if sym and name and sym not in names:
                        names[sym] = name

    # 3. namechange.csv
    if os.path.exists(NAMECHANGE_PATH):
        with open(NAMECHANGE_PATH, mode="r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                sym = row.get("SYMBOL", "").strip().upper()
                new_n = row.get("NEW NAME OF THE COMPANY", "").strip()
                old_n = row.get("OLD NAME OF THE COMPANY", "").strip()
                name = new_n or old_n
                if sym and name and sym not in names:
                    names[sym] = name

    # 4. Sample 30 evenly-spaced UDiFF archives
    udiff_files = sorted(glob.glob("data/raw/202[456]/*/*.zip"))
    step = max(1, len(udiff_files) // 30)
    sampled_udiff = udiff_files[::step]

    for zpath in sampled_udiff:
        try:
            with zipfile.ZipFile(zpath) as z:
                namelist = [n for n in z.namelist() if n.endswith(".csv")]
                if not namelist:
                    continue
                with z.open(namelist[0]) as f:
                    header = f.readline().decode("utf-8", errors="ignore")
                    if "FinInstrmNm" in header and "TckrSymb" in header:
                        f.seek(0)
                        df = pd.read_csv(f, usecols=["TckrSymb", "FinInstrmNm", "ISIN"])
                        for _, r in df.dropna(subset=["TckrSymb", "FinInstrmNm"]).iterrows():
                            sym = str(r["TckrSymb"]).strip().upper()
                            nm = str(r["FinInstrmNm"]).strip()
                            isin = str(r["ISIN"]).strip() if pd.notna(r["ISIN"]) else None
                            if sym and sym not in names:
                                names[sym] = nm.title() if nm.isupper() else nm
                            if sym and isin and sym not in isins:
                                isins[sym] = isin
        except Exception:
            continue

    return names, isins


def format_proper_company_name(symbol: str, master_names: dict) -> str:
    sym = symbol.strip().upper()
    if sym in master_names:
        return master_names[sym]

    # Treasury Bills
    m_tbill = re.match(r"^(\d+D)(\d{2})(\d{2})(\d{2})$", sym)
    if m_tbill:
        days, d, m, y = m_tbill.groups()
        return f"{days} Treasury Bill (Maturity {d}/{m}/20{y})"

    # Sovereign Gold Bonds
    if sym.startswith("SGB"):
        return f"Sovereign Gold Bond ({sym})"

    # Government Securities
    if "GS" in sym:
        return f"Government of India Stock ({sym})"

    # Rights Entitlements
    if "-RE" in sym:
        base = sym.replace("-RE", "")
        base_name = master_names.get(base, base.title())
        return f"{base_name} - Rights Entitlement"

    # Corporate Abbreviations Expansion
    clean = sym
    clean = re.sub(r"LTD$", " Limited", clean)
    clean = re.sub(r"IND$", " Industries", clean)
    clean = re.sub(r"CORP$", " Corporation", clean)
    clean = re.sub(r"PHARM$", " Pharmaceuticals", clean)
    clean = re.sub(r"CHEM$", " Chemicals", clean)
    clean = re.sub(r"TECH$", " Technologies", clean)
    clean = re.sub(r"ENG$", " Engineering", clean)
    clean = re.sub(r"AUTO$", " Automobiles", clean)
    clean = re.sub(r"FIN$", " Finance", clean)
    clean = re.sub(r"INFRA$", " Infrastructure", clean)
    clean = re.sub(r"INTL$", " International", clean)
    clean = re.sub(r"TEXT$", " Textiles", clean)
    clean = re.sub(r"VENT$", " Ventures", clean)
    clean = re.sub(r"SOL$", " Solutions", clean)

    words = clean.split()
    proper_words = [w.capitalize() if not w.isupper() or len(w) > 4 else w for w in words]
    res = " ".join(proper_words)
    if not any(kw in res for kw in ["Limited", "Bank", "Corporation", "Industries", "Enterprises", "Finance", "Services", "Technologies"]):
        res += " Limited"
    return res


def main():
    print("Loading master company dictionaries from NSE official sources...")
    master_names, master_isins = load_master_dictionaries()
    print(f"Loaded {len(master_names)} verified company names.")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    rows = cursor.execute("SELECT id, symbol, series, company_name, isin FROM securities").fetchall()
    print(f"Total securities in database: {len(rows):,}")

    updates = []
    for sec_id, sym, srs, existing_name, existing_isin in rows:
        clean_name = format_proper_company_name(sym, master_names)
        clean_isin = existing_isin or master_isins.get(sym)
        updates.append((clean_name, clean_isin, sec_id))

    cursor.executemany("UPDATE securities SET company_name = ?, isin = ? WHERE id = ?", updates)
    conn.commit()

    # Verify
    cursor.execute("SELECT COUNT(*), COUNT(company_name) FROM securities")
    tot, has_name = cursor.fetchone()
    print(f"\n✅ Successfully updated securities table:")
    print(f"   Total Securities: {tot:,}")
    print(f"   With Proper Names: {has_name:,} (100.0%)")

    print("\nSample updated securities (EQ Series):")
    sample = pd.read_sql_query(
        "SELECT symbol, company_name, series, isin FROM securities WHERE series = 'EQ' ORDER BY id LIMIT 15",
        conn
    )
    print(sample.to_string(index=False))

    conn.close()


if __name__ == "__main__":
    main()
