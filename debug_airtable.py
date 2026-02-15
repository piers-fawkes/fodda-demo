
import urllib.request
import urllib.parse
import json
import ssl

import os
AIRTABLE_PAT = os.environ.get('AIRTABLE_PAT', '')
BASE_ID = 'appXUeeWN1uD9NdCW'
USERS_TABLE = 'tblGWh6XpdEZxw8AE'
PLANS_TABLE = 'tblq2T5OUyrDFCda9'
ACCOUNTS_TABLE = 'tblt6mh0XQOablFDX'
API_KEYS_TABLE = 'tblsDGYv8pFpNegcf'

def query_airtable(table_id, formula):
    encoded_formula = urllib.parse.quote(formula)
    url = f"https://api.airtable.com/v0/{BASE_ID}/{table_id}?filterByFormula={encoded_formula}"
    print(f"Querying table {table_id} with formula: {formula}")
    
    req = urllib.request.Request(url)
    req.add_header('Authorization', f'Bearer {AIRTABLE_PAT}')
    
    context = ssl._create_unverified_context()
    
    try:
        with urllib.request.urlopen(req, context=context) as response:
            data = json.loads(response.read().decode('utf-8'))
            print(f"Success! Found {len(data.get('records', []))} records.")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f"Error ({e.code}): {error_body}")
    except Exception as e:
        print(f"Exception: {str(e)}")




print("\n--- Inspecting ACCOUNTS_TABLE fields ---")
try:
    url = f"https://api.airtable.com/v0/{BASE_ID}/{ACCOUNTS_TABLE}?maxRecords=1"
    req = urllib.request.Request(url)
    req.add_header('Authorization', f'Bearer {AIRTABLE_PAT}')
    context = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=context) as response:
        data = json.loads(response.read().decode('utf-8'))
        if data.get('records'):
            print("Fields found:", list(data['records'][0]['fields'].keys()))
        else:
            print("No records found in ACCOUNTS_TABLE")
except Exception as e:
    print(f"Inspection Error: {e}")

print("\n--- Inspecting API_KEYS_TABLE fields ---")
try:
    url = f"https://api.airtable.com/v0/{BASE_ID}/{API_KEYS_TABLE}?maxRecords=1"
    req = urllib.request.Request(url)
    req.add_header('Authorization', f'Bearer {AIRTABLE_PAT}')
    context = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=context) as response:
        data = json.loads(response.read().decode('utf-8'))
        if data.get('records'):
            print("Fields found:", list(data['records'][0]['fields'].keys()))
        else:
            print("No records found in API_KEYS_TABLE")
except Exception as e:
    print(f"Inspection Error: {e}")



