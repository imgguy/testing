import requests
from termcolor import colored
import time
import concurrent.futures
import os
import re
from tqdm import tqdm
from threading import Lock
import argparse
import random
import string

# === BACKUP FUNCTION ===
def backup_and_clear():
    target_files = [
        "availableHotmail.txt",
        "notAvailableHotmail.txt",
        "checked_emails.txt",
        "emails.txt"
    ]
    suffix = ''.join(random.choices(string.digits, k=4))
    for filename in target_files:
        if os.path.exists(filename):
            new_name = f"{filename.rsplit('.', 1)[0]}_{suffix}.txt"
            os.rename(filename, new_name)
            open(filename, 'w', encoding='utf-8').close()

# === PARSE ARGS EARLY FOR BACKUP ===
parser = argparse.ArgumentParser(description="Hotmail Availability Checker")
parser.add_argument("--filter-hotmail", action="store_true", help="Filter Hotmail emails (sorted)")
parser.add_argument("--filter-hotmail-unsorted", action="store_true", help="Filter Hotmail emails (unsorted)")
parser.add_argument("--filter-all-ms", action="store_true", help="Filter all Microsoft emails (sorted)")
parser.add_argument("--remove-dupes", action="store_true", help="Remove duplicates from 'emails.txt'")
parser.add_argument("--check", action="store_true", help="Start checking emails")
parser.add_argument("--continue", dest="continue_check", action="store_true", help="Continue from last progress")
parser.add_argument("--threads", type=int, help="Set thread count (1-100)")
parser.add_argument("--backup", action="store_true", help="Backup and clear output files before running")
parser.add_argument("-s", "--suffix", type=str, help="Suffix to append to output filenames (use 'off' to disable)")

args = parser.parse_args()

if args.backup:
    backup_and_clear()

# === APPLY SUFFIX TO OUTPUT FILE NAMES ===
suffix_part = "" if (args.suffix is None or args.suffix.strip().lower() == "off") else args.suffix.strip()

def suffix_filename(base):
    if suffix_part:
        return f"{base[:-4]}{suffix_part}.txt"
    return base

available_path = suffix_filename("availableHotmail.txt")
not_available_path = suffix_filename("notAvailableHotmail.txt")
checked_file_path = suffix_filename("checked_emails.txt")

# === SET TITLE & FILE HANDLERS ===
os.system('title Hotmail Checker @imgguy')

available = open(available_path, 'a+', encoding='utf-8')
notAvailable = open(not_available_path, 'a+', encoding='utf-8')

THREAD_COUNT = 30
if args.threads:
    if 1 <= args.threads <= 100:
        THREAD_COUNT = args.threads
    else:
        print(colored("Thread count must be between 1 and 100.", 'red'))
        exit(1)

stats = {
    "available": 0,
    "taken": 0,
    "errors": 0
}
lock = Lock()

def check(email):
    try:
        availableText = "Neither"
        notAvailableText = "MSAccount"
        link = f"https://odc.officeapps.live.com/odc/emailhrd/getidp?hm=0&emailAddress={email}&_=1604288577990"
        header = {
            "Accept": "*/*",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Connection": "close",
            "Host": "odc.officeapps.live.com",
            "Accept-Encoding": "gzip, deflate",
            "Referer": "https://odc.officeapps.live.com/odc/",
            "Accept-Language": "en-US,en;q=0.9",
            "canary": "...",
            "uaid": "...",
            "Cookie": "..."
        }
        response = requests.get(link, headers=header, timeout=10).text
        with lock:
            if availableText in response:
                tqdm.write(colored("[+] AVAILABLE " + email, 'green'))
                available.write(email + "\n")
                available.flush()
                stats["available"] += 1
            elif notAvailableText in response:
                tqdm.write(colored("[-] TAKEN " + email, 'red'))
                notAvailable.write(email + "\n")
                notAvailable.flush()
                stats["taken"] += 1
            else:
                stats["errors"] += 1
            with open(checked_file_path, 'a', encoding='utf-8') as cf:
                cf.write(email + '\n')
    except Exception:
        with lock:
            stats["errors"] += 1
            tqdm.write(colored(f"[!] ERROR {email}", 'yellow'))
            with open(checked_file_path, 'a', encoding='utf-8') as cf:
                cf.write(email + '\n')

def filter_hotmail_emails(sorted_output=True):
    hotmails = []
    seen = set()
    with open('s.txt', 'r', encoding='utf-8') as source:
        for line in source:
            matches = re.findall(r'[a-zA-Z0-9._%+-]+@hotmail\.com', line, re.IGNORECASE)
            for email in matches:
                email_lower = email.lower()
                if email_lower not in seen:
                    seen.add(email_lower)
                    hotmails.append(email_lower)
    if sorted_output:
        hotmails.sort()
    with open('emails.txt', 'w', encoding='utf-8') as output:
        for email in hotmails:
            output.write(email + '\n')
    order_msg = "alphabetically sorted" if sorted_output else "in original order"
    print(colored(f"\nExtracted {len(hotmails)} Hotmail emails {order_msg} into 'emails.txt'\n", 'cyan'))

def filter_all_ms_emails(sorted_output=True):
    ms_domains = r'(hotmail\.com|outlook\.com|live\.com|msn\.com|passport\.com)'
    found = []
    seen = set()
    with open('s.txt', 'r', encoding='utf-8') as source:
        for line in source:
            matches = re.findall(rf'[a-zA-Z0-9._%+-]+@{ms_domains}', line, re.IGNORECASE)
            for email in matches:
                email_lower = email.lower()
                if email_lower not in seen:
                    seen.add(email_lower)
                    found.append(email_lower)
    if sorted_output:
        found.sort()
    with open('emails.txt', 'w', encoding='utf-8') as output:
        for email in found:
            output.write(email + '\n')
    order_msg = "alphabetically sorted" if sorted_output else "in original order"
    print(colored(f"\nExtracted {len(found)} Microsoft emails {order_msg} into 'emails.txt'\n", 'cyan'))

def remove_duplicates():
    try:
        with open('emails.txt', 'r', encoding='utf-8') as f:
            lines = f.readlines()
        seen = set()
        unique_emails = []
        for line in lines:
            email = line.strip().lower()
            if email and email not in seen:
                seen.add(email)
                unique_emails.append(email)
        with open('emails.txt', 'w', encoding='utf-8') as f:
            for email in unique_emails:
                f.write(email + '\n')
        print(colored(f"\nRemoved duplicates. {len(unique_emails)} unique emails saved in 'emails.txt'\n", 'cyan'))
    except FileNotFoundError:
        print(colored("emails.txt not found. Make sure it exists before using this option.", 'red'))

def start_checking():
    try:
        with open('emails.txt', 'r', encoding='utf-8') as f:
            emails = [line.strip() for line in f if line.strip()]
        open(checked_file_path, 'w').close()
        stats["available"] = 0
        stats["taken"] = 0
        stats["errors"] = 0

        print(colored(f"\n[!] Checking {len(emails)} emails with {THREAD_COUNT} threads...\n", 'yellow'))
        time.sleep(.5)
        with concurrent.futures.ThreadPoolExecutor(max_workers=THREAD_COUNT) as executor:
            list(tqdm(executor.map(check, emails), total=len(emails), desc="Progress", ncols=70))
        print(colored(f"\n✓ Available: {stats['available']}", 'green'))
        print(colored(f"✗ Taken:     {stats['taken']}", 'red'))
        print(colored(f"! Errors:    {stats['errors']}", 'yellow'))
    except FileNotFoundError:
        print(colored("emails.txt not found. Use filtering options first or ensure the file exists.", 'red'))
    input("Press Enter to return to main menu...")

def continue_checking():
    try:
        with open('emails.txt', 'r', encoding='utf-8') as f:
            all_emails = [line.strip() for line in f if line.strip()]
        try:
            with open(checked_file_path, 'r', encoding='utf-8') as cf:
                checked_emails = set(line.strip() for line in cf if line.strip())
        except FileNotFoundError:
            checked_emails = set()

        remaining = [email for email in all_emails if email not in checked_emails]

        if not remaining:
            print(colored("No emails left to check. All done!", 'green'))
            input("Press Enter to return to main menu...")
            return

        print(colored(f"\n[!] Continuing check of {len(remaining)} emails with {THREAD_COUNT} threads...\n", 'yellow'))
        time.sleep(.5)
        with concurrent.futures.ThreadPoolExecutor(max_workers=THREAD_COUNT) as executor:
            list(tqdm(executor.map(check, remaining), total=len(remaining), desc="Progress", ncols=70))
        print(colored(f"\n✓ Available: {stats['available']}", 'green'))
        print(colored(f"✗ Taken:     {stats['taken']}", 'red'))
        print(colored(f"! Errors:    {stats['errors']}", 'yellow'))
    except FileNotFoundError:
        print(colored("emails.txt or checked_emails.txt not found. Make sure both exist.", 'red'))
    input("Press Enter to return to main menu...")

def main_menu():
    global THREAD_COUNT
    while True:
        print(colored('''
  _    _       _                   _ _    _____ _               _             
 | |  | |     | |                 (_) |  / ____| |             | |            
 | |__| | ___ | |_ _ __ ___   __ _ _| | | |    | |__   ___  ___| | _____ _ __ 
 |  __  |/ _ \| __| '_ ` _ \ / _` | | | | |    | '_ \ / _ \/ __| |/ / _ \ '__|
 | |  | | (_) | |_| | | | | | (_| | | | | |____| | | |  __/ (__|   <  __/ |   
 |_|  |_|\___/ \__|_| |_| |_|\__,_|_|_|  \_____|_| |_|\___|\___|_|\_\___|_|   
   CREDITS imgguy
''', 'yellow', attrs=['bold']))

        print("1. Filter Hotmail emails (alphabetically sorted) from 's.txt' to 'emails.txt'")
        print("2. Filter Hotmail emails (keep original order) from 's.txt' to 'emails.txt'")
        print("3. Start checking emails from 'emails.txt'")
        print("4. Remove duplicates from 'emails.txt'")
        print("5. Filter ALL Microsoft emails (alphabetically sorted) from 's.txt' to 'emails.txt'")
        print("6. Change thread count (current: {})".format(THREAD_COUNT))
        print("7. Continue checking from last progress")
        print("Q. Quit")

        choice = input("Your choice: ").strip().lower()

        if choice == '1':
            filter_hotmail_emails(sorted_output=True)
            input("Press Enter to return to main menu...")
        elif choice == '2':
            filter_hotmail_emails(sorted_output=False)
            input("Press Enter to return to main menu...")
        elif choice == '3':
            start_checking()
        elif choice == '4':
            remove_duplicates()
            input("Press Enter to return to main menu...")
        elif choice == '5':
            filter_all_ms_emails(sorted_output=True)
            input("Press Enter to return to main menu...")
        elif choice == '6':
            try:
                new_count = int(input("Enter new thread count (1-100): ").strip())
                if 1 <= new_count <= 100:
                    THREAD_COUNT = new_count
                    print(colored(f"Thread count updated to {THREAD_COUNT}", 'cyan'))
                else:
                    print(colored("Invalid input, must be between 1 and 100.", 'red'))
            except ValueError:
                print(colored("Invalid input, please enter a number.", 'red'))
            input("Press Enter to return to main menu...")
        elif choice == '7':
            continue_checking()
        elif choice == 'q':
            print("Exiting...")
            break
        else:
            print("Invalid input. Try again.\n")

# === COMMAND MODE EXECUTION ===
any_action = False

if args.filter_hotmail:
    filter_hotmail_emails(sorted_output=True)
    any_action = True

if args.filter_hotmail_unsorted:
    filter_hotmail_emails(sorted_output=False)
    any_action = True

if args.filter_all_ms:
    filter_all_ms_emails(sorted_output=True)
    any_action = True

if args.remove_dupes:
    remove_duplicates()
    any_action = True

if args.check:
    start_checking()
    any_action = True

if args.continue_check:
    continue_checking()
    any_action = True

if not any_action:
    main_menu()
