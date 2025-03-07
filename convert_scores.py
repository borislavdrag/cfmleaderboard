import csv
import sys

def convert_to_leaderboard_format(input_file, output_file, workout_number):
    with open(input_file, 'r', encoding='utf-8') as infile, open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        reader = csv.DictReader(infile)  # Use DictReader to read by column names
        writer = csv.writer(outfile)
        
        # Write header for output file
        writer.writerow(['category', 'name', 'version', 'score', 'tiebreak'])
        
        for row in reader:
            # Get values using the actual column names from the input file
            name = row['Vor- und Nachname'].strip()
            category = row['Category'].strip()
            version = row['Version'].strip()
            score = row['Reps or Time'].strip() if row['Reps or Time'] else ''
            tiebreak = row['Tiebreak Time'].strip() if row['Tiebreak Time'] else ''
            
            # Clean up version field
            version = 'rx' if version.lower() in ['rx', 'rx\'d'] else 'sc'
            
            # For workout 2, if score is not in time format (mm:ss), add default tiebreak
            if workout_number == 2 and score and not ':' in score:
                if not tiebreak:  # Only set default if no tiebreak provided
                    tiebreak = '12:00'
            
            # Fix category determination
            category = category.lower()
            if category in ['men', 'male', 'männer']:
                category = 'men'
            elif category in ['women', 'female', 'frauen']:
                category = 'women'
            else:
                print(f"Warning: Unknown category '{category}' for {name}, defaulting to men")
                category = 'men'
            
            # Write the row with all fields
            writer.writerow([category, name, version, score, tiebreak])

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python convert_scores.py <input_file> <output_file> <workout_number>")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    workout_number = int(sys.argv[3])
    
    convert_to_leaderboard_format(input_file, output_file, workout_number)
    print(f"Conversion complete! Output written to {output_file}")