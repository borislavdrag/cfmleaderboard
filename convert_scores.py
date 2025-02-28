import csv
from datetime import datetime

def convert_scoresheet(input_file, output_file):
    # Read scoresheet
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        scores = []
        for row in reader:
            # Determine category (we'll need to manually assign or infer from a separate list)
            category = "unknown"  # You'll need to provide this information
            
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
convert_scoresheet('scoresheet25_1.csv', 'leaderboard_25_1_temp.csv') 