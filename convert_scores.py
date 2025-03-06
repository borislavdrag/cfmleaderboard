import csv
from datetime import datetime

def convert_scoresheet(input_file, output_file):
    # Read scoresheet
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        scores = []
        for row in reader:
            # Get category and convert to lowercase
            category = row['Category'].lower()
            
            # Clean up the data
            name = row['Vor- und Nachname'].strip()
            version = "rx" if row['Version'].lower() == "rx" else "sc"
            score = int(row['Reps'])
            
            scores.append({
                'category': category,
                'name': name,
                'version': version,
                'score': score,
                'tiebreak': ''  # Empty as specified
            })

    # Write to leaderboard format
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['category', 'name', 'version', 'score', 'tiebreak'])
        writer.writeheader()
        for score in scores:
            writer.writerow(score)

# Usage
convert_scoresheet('scoresheet25_1.csv', 'leaderboard_25_1.csv')