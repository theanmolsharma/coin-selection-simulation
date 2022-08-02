import csv
import json
import os

# A function to convert CSV files to JSON
def csv_to_json(csv_file_path, json_file_path):
    l = []

    with open(csv_file_path, encoding='utf-8') as csv_file_handler:
        csv_reader = csv.DictReader(csv_file_handler)

        for rows in csv_reader:
            l.append(rows)

    with open(json_file_path, 'w', encoding='utf-8') as json_file_handler:
        json_file_handler.write(json.dumps(l, indent=4))


src = ['csv/payments', 'csv/scenarios']
dest = ['json/payments', 'json/scenarios']
for i in range(2):
    files = os.listdir(src[i])
    for f in files:
        csv_path = src[i] + '/' + f
        json_path = dest[i] + '/' + f[:-3] + 'json'
        print("Converting", f)
        csv_to_json(csv_path, json_path)
        print("Done!!")