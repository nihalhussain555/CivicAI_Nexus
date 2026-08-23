from pathlib import Path
import csv
import random

random.seed(42)

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT = BASE_DIR / "datasets" / "complaints.csv"

TARGET_PER_DEPARTMENT = 300


# ============================================================
# DEPARTMENT DATA
# ============================================================

DATA = {

"Municipal Corporation": {

"English": [
    "The street lights in my neighborhood are not working",
    "The drainage near my house is blocked",
    "Our locality needs regular street cleaning",
    "The public park in our area is poorly maintained",
    "The municipal workers have not cleaned our street",
    "The footpath near the market is damaged",
    "The public toilet in our locality is not maintained",
    "The road drainage is overflowing after rain",
    "Our residential area needs better municipal services",
    "The community park has become unusable",
    "The street cleaning schedule is not being followed",
    "The drain beside our street is completely blocked",
    "The municipal water tanker is not arriving on time",
    "The streetlight pole near my house is damaged",
    "The public facility in our ward requires maintenance",
],

"Tamil": [
    "எங்கள் பகுதியில் தெருவிளக்குகள் வேலை செய்யவில்லை",
    "எங்கள் வீட்டின் அருகே கழிவுநீர் கால்வாய் அடைந்துள்ளது",
    "எங்கள் பகுதியில் தெருக்களை முறையாக சுத்தம் செய்ய வேண்டும்",
    "எங்கள் பகுதியில் உள்ள பூங்கா சரியாக பராமரிக்கப்படவில்லை",
    "எங்கள் தெருவை நகராட்சி ஊழியர்கள் சுத்தம் செய்யவில்லை",
    "சந்தைக்கு அருகிலுள்ள நடைபாதை சேதமடைந்துள்ளது",
    "எங்கள் பகுதியில் உள்ள பொது கழிப்பிடம் பராமரிக்கப்படவில்லை",
    "மழைக்குப் பிறகு சாலை கால்வாயில் நீர் நிரம்புகிறது",
    "எங்கள் குடியிருப்பு பகுதியில் நகராட்சி சேவைகள் மேம்பட வேண்டும்",
    "எங்கள் பகுதியில் உள்ள பூங்கா பயன்படுத்த முடியாத நிலையில் உள்ளது",
    "தெரு சுத்தம் செய்யும் அட்டவணை பின்பற்றப்படவில்லை",
    "எங்கள் தெருவின் அருகிலுள்ள கால்வாய் அடைத்துள்ளது",
    "நகராட்சி தண்ணீர் வாகனம் சரியான நேரத்தில் வரவில்லை",
    "எங்கள் வீட்டருகே உள்ள தெருவிளக்கு கம்பம் சேதமடைந்துள்ளது",
    "எங்கள் வார்டில் உள்ள பொது வசதிக்கு பராமரிப்பு தேவை",
],

"Tanglish": [
    "Enga area la street lights work aagala",
    "Enga veetu pakkathula drainage block aayiduchu",
    "Enga locality la street cleaning proper ah nadakala",
    "Enga area park proper ah maintain pannala",
    "Municipality workers enga street ah clean pannala",
    "Market pakkathula footpath damage aayiduchu",
    "Enga area public toilet maintain pannala",
    "Rain vandha apram road drainage overflow aagudhu",
    "Enga residential area ku better municipal service venum",
    "Enga area park use panna mudiyala",
    "Street cleaning schedule follow pannala",
    "Enga street pakkathula drain block aayiduchu",
    "Municipal water tanker correct time ku varala",
    "Enga veetu pakkathula street light pole damage aayiduchu",
    "Enga ward public facility ku maintenance venum",
]
},


"Electricity": {

"English": [
    "There has been no power supply in our area since yesterday",
    "The transformer near our street is making unusual sounds",
    "Our electricity connection keeps getting interrupted",
    "The power pole outside my house is damaged",
    "There is frequent voltage fluctuation in our locality",
    "The electricity meter is not functioning correctly",
    "Our neighborhood experiences daily power cuts",
    "The electric wire near the road is hanging dangerously",
    "The transformer in our locality appears overloaded",
    "My electricity bill shows an incorrect reading",
    "The power supply has not been restored after the outage",
    "Several houses in our street have lost electricity",
    "The electricity connection at my property is delayed",
    "The street electrical line is damaged",
    "The power meter has stopped recording consumption",
],

"Tamil": [
    "எங்கள் பகுதியில் நேற்று முதல் மின்சாரம் இல்லை",
    "எங்கள் தெருவின் அருகிலுள்ள மின்மாற்றியில் வித்தியாசமான சத்தம் வருகிறது",
    "எங்கள் மின் இணைப்பு அடிக்கடி துண்டிக்கப்படுகிறது",
    "எங்கள் வீட்டிற்கு வெளியே உள்ள மின்கம்பம் சேதமடைந்துள்ளது",
    "எங்கள் பகுதியில் அடிக்கடி மின்னழுத்த ஏற்ற இறக்கம் ஏற்படுகிறது",
    "மின் மீட்டர் சரியாக வேலை செய்யவில்லை",
    "எங்கள் பகுதியில் தினமும் மின்தடை ஏற்படுகிறது",
    "சாலையின் அருகே மின்கம்பி ஆபத்தான நிலையில் தொங்குகிறது",
    "எங்கள் பகுதியில் உள்ள மின்மாற்றி அதிக சுமையில் இருப்பது போல் தெரிகிறது",
    "என் மின்சார கட்டணத்தில் தவறான அளவு காட்டப்பட்டுள்ளது",
    "மின்தடைக்குப் பிறகு மின்சாரம் மீண்டும் வழங்கப்படவில்லை",
    "எங்கள் தெருவில் பல வீடுகளுக்கு மின்சாரம் இல்லை",
    "என் வீட்டின் மின் இணைப்பு தாமதமாகிறது",
    "தெருவில் உள்ள மின் கம்பி சேதமடைந்துள்ளது",
    "மின் மீட்டர் பயன்பாட்டை பதிவு செய்யவில்லை",
],

"Tanglish": [
    "Enga area la netthu la irundhu current illa",
    "Enga street pakkathula transformer unusual sound varudhu",
    "Enga electricity connection adikkadi cut aagudhu",
    "Enga veetu veliya irukkura power pole damage aayiduchu",
    "Enga area la voltage fluctuation romba irukku",
    "Electricity meter correct ah work aagala",
    "Enga locality la daily power cut aagudhu",
    "Road pakkathula electric wire dangerous ah thongudhu",
    "Enga area transformer overload aana madhiri irukku",
    "En electricity bill la wrong reading irukku",
    "Power cut ku apram current innum varala",
    "Enga street la neraya veetuku current illa",
    "En veetu electricity connection delay aagudhu",
    "Street electrical wire damage aayiduchu",
    "Power meter consumption record pannala",
]
},


"Water Supply": {

"English": [
    "There is no drinking water supply in our neighborhood",
    "Water has not reached our street since yesterday",
    "The public water pipeline is leaking",
    "Our water pressure is extremely low",
    "The water supply schedule is not being followed",
    "The overhead water tank is not receiving water",
    "Dirty water is coming through the public pipeline",
    "Our locality receives water only for a few minutes",
    "The water pipeline near our house has burst",
    "The public tap has stopped working",
    "Water supply has been irregular for several weeks",
    "Our village has insufficient drinking water",
    "The water connection application is still pending",
    "The municipal pipeline is damaged",
    "The supplied water has an unusual smell",
],

"Tamil": [
    "எங்கள் பகுதியில் குடிநீர் விநியோகம் இல்லை",
    "நேற்று முதல் எங்கள் தெருவிற்கு தண்ணீர் வரவில்லை",
    "பொது குடிநீர் குழாயில் கசிவு உள்ளது",
    "எங்கள் பகுதியில் தண்ணீர் அழுத்தம் மிகவும் குறைவாக உள்ளது",
    "தண்ணீர் விநியோக அட்டவணை பின்பற்றப்படவில்லை",
    "மேல்நிலை நீர்த்தேக்க தொட்டிக்கு தண்ணீர் வரவில்லை",
    "பொது குழாயில் அழுக்கான தண்ணீர் வருகிறது",
    "எங்கள் பகுதியில் சில நிமிடங்கள் மட்டுமே தண்ணீர் வருகிறது",
    "எங்கள் வீட்டருகே குடிநீர் குழாய் உடைந்துள்ளது",
    "பொது தண்ணீர் குழாய் வேலை செய்யவில்லை",
    "பல வாரங்களாக தண்ணீர் விநியோகம் சீராக இல்லை",
    "எங்கள் கிராமத்தில் போதுமான குடிநீர் இல்லை",
    "தண்ணீர் இணைப்பு விண்ணப்பம் இன்னும் நிலுவையில் உள்ளது",
    "நகராட்சி குடிநீர் குழாய் சேதமடைந்துள்ளது",
    "விநியோகிக்கப்படும் தண்ணீரில் வித்தியாசமான வாசனை உள்ளது",
],

"Tanglish": [
    "Enga area la drinking water supply illa",
    "Netthu la irundhu enga street ku water varala",
    "Public water pipe la leakage irukku",
    "Enga area la water pressure romba kammi",
    "Water supply schedule follow pannala",
    "Overhead water tank ku water varala",
    "Public pipeline la dirty water varudhu",
    "Enga area ku konjam neram mattum water varudhu",
    "Enga veetu pakkathula water pipe burst aayiduchu",
    "Public tap work aagala",
    "Pala weeks ah water supply regular ah illa",
    "Enga village la drinking water pothala",
    "Water connection application innum pending la irukku",
    "Municipal water pipeline damage aayiduchu",
    "Supply aagura water la strange smell irukku",
]
},


"Sanitation & Waste Management": {

"English": [
    "Garbage has not been collected from our street",
    "Waste bins in our area are overflowing",
    "The garbage vehicle has stopped visiting our locality",
    "Household waste is piling up near our houses",
    "There is an open garbage dump beside the road",
    "Waste collection has been irregular in our neighborhood",
    "The garbage container near the market is overflowing",
    "Our street has not been cleaned for several days",
    "People are dumping waste on the roadside",
    "The waste collection workers are not coming regularly",
    "There is a large pile of rubbish near the bus stop",
    "The garbage collection service has been delayed",
    "Our locality has a serious solid waste problem",
    "The waste bin near our apartment is full",
    "Uncollected garbage is causing a bad smell",
],

"Tamil": [
    "எங்கள் தெருவில் குப்பை சேகரிக்கப்படவில்லை",
    "எங்கள் பகுதியில் உள்ள குப்பைத் தொட்டிகள் நிரம்பி வழிகின்றன",
    "குப்பை வாகனம் எங்கள் பகுதிக்கு வருவதை நிறுத்திவிட்டது",
    "வீட்டு குப்பைகள் எங்கள் வீடுகளுக்கு அருகில் குவிந்துள்ளன",
    "சாலையின் அருகில் திறந்த குப்பை மேடு உள்ளது",
    "எங்கள் பகுதியில் குப்பை சேகரிப்பு சீராக இல்லை",
    "சந்தைக்கு அருகிலுள்ள குப்பைத் தொட்டி நிரம்பியுள்ளது",
    "எங்கள் தெரு பல நாட்களாக சுத்தம் செய்யப்படவில்லை",
    "மக்கள் சாலையோரத்தில் குப்பைகளை கொட்டுகின்றனர்",
    "குப்பை சேகரிப்பு பணியாளர்கள் முறையாக வரவில்லை",
    "பேருந்து நிறுத்தம் அருகே அதிக அளவு குப்பை குவிந்துள்ளது",
    "குப்பை சேகரிப்பு சேவை தாமதமாகியுள்ளது",
    "எங்கள் பகுதியில் திடக்கழிவு பிரச்சனை உள்ளது",
    "எங்கள் குடியிருப்பின் அருகிலுள்ள குப்பைத் தொட்டி நிரம்பியுள்ளது",
    "சேகரிக்கப்படாத குப்பையால் துர்நாற்றம் ஏற்படுகிறது",
],

"Tanglish": [
    "Enga street la garbage collect pannala",
    "Enga area garbage bins overflow aagudhu",
    "Garbage vehicle enga locality ku varradha stop panniduchu",
    "Veetu waste enga veetu pakkathula pile aagudhu",
    "Road side la open garbage dump irukku",
    "Enga neighborhood la waste collection regular ah illa",
    "Market pakkathula garbage container full ah irukku",
    "Enga street pala naala clean pannala",
    "People road side la waste dump panranga",
    "Garbage collection workers regular ah varala",
    "Bus stop pakkathula rubbish romba pile aayirukku",
    "Garbage collection service delay aayiduchu",
    "Enga locality la solid waste problem romba irukku",
    "Apartment pakkathula garbage bin full ah irukku",
    "Collect pannadha garbage nala bad smell varudhu",
]
},

}


# ============================================================
# ADDITIONAL DEPARTMENTS
# ============================================================

DATA.update({

"Health": {
"English": [
    "The government hospital does not have essential medicines",
    "The doctor is unavailable at the public health centre",
    "The hospital lacks basic medical equipment",
    "The ambulance service is not responding",
    "The health centre is overcrowded",
    "My medical report has been delayed",
    "The government clinic is not open during working hours",
    "There are no beds available in the public hospital",
    "The vaccination service is unavailable",
    "The pharmacy at the hospital has no medicines",
],
"Tamil": [
    "அரசு மருத்துவமனையில் அத்தியாவசிய மருந்துகள் இல்லை",
    "அரசு சுகாதார மையத்தில் மருத்துவர் இல்லை",
    "மருத்துவமனையில் அடிப்படை மருத்துவ உபகரணங்கள் இல்லை",
    "ஆம்புலன்ஸ் சேவை பதிலளிக்கவில்லை",
    "சுகாதார மையத்தில் அதிக கூட்டம் உள்ளது",
    "எனது மருத்துவ அறிக்கை தாமதமாகியுள்ளது",
    "அரசு மருத்துவமனை வேலை நேரத்தில் திறக்கப்படவில்லை",
    "அரசு மருத்துவமனையில் படுக்கைகள் இல்லை",
    "தடுப்பூசி சேவை கிடைக்கவில்லை",
    "மருத்துவமனை மருந்தகத்தில் மருந்துகள் இல்லை",
],
"Tanglish": [
    "Government hospital la essential medicines illa",
    "Public health centre la doctor illa",
    "Hospital la basic medical equipment illa",
    "Ambulance service response pannala",
    "Health centre la romba crowd irukku",
    "En medical report delay aayiduchu",
    "Government clinic working hours la open aagala",
    "Public hospital la beds available illa",
    "Vaccination service available illa",
    "Hospital pharmacy la medicines illa",
]
},

"Education": {
"English": [
    "My scholarship has not been credited",
    "The government school does not have enough teachers",
    "Our school lacks proper classroom facilities",
    "The college has not issued my certificate",
    "The school building requires urgent repair",
    "My student scholarship application is pending",
    "There are no computers in our government school",
    "The school library does not have enough books",
    "My education certificate has not arrived",
    "The government hostel needs better facilities",
],
"Tamil": [
    "எனது கல்வி உதவித்தொகை இன்னும் வரவில்லை",
    "அரசுப் பள்ளியில் போதுமான ஆசிரியர்கள் இல்லை",
    "எங்கள் பள்ளியில் சரியான வகுப்பறை வசதிகள் இல்லை",
    "கல்லூரி எனது சான்றிதழை வழங்கவில்லை",
    "பள்ளி கட்டிடத்திற்கு அவசர பராமரிப்பு தேவை",
    "எனது கல்வி உதவித்தொகை விண்ணப்பம் நிலுவையில் உள்ளது",
    "எங்கள் அரசுப் பள்ளியில் கணினிகள் இல்லை",
    "பள்ளி நூலகத்தில் போதுமான புத்தகங்கள் இல்லை",
    "எனது கல்விச் சான்றிதழ் இன்னும் வரவில்லை",
    "அரசு விடுதிக்கு சிறந்த வசதிகள் தேவை",
],
"Tanglish": [
    "En scholarship amount innum credit aagala",
    "Government school la teachers pothala",
    "Enga school la proper classroom facilities illa",
    "College en certificate issue pannala",
    "School building ku urgent repair venum",
    "En scholarship application pending la irukku",
    "Enga government school la computers illa",
    "School library la books pothala",
    "En education certificate innum varala",
    "Government hostel ku better facilities venum",
]
},

"Police": {
"English": [
    "I want to report a theft in my neighborhood",
    "There is a suspicious person near our residential area",
    "My vehicle has been stolen",
    "I need to file a police complaint",
    "There is frequent illegal activity near our street",
    "Someone has damaged my property",
    "I received a threatening message",
    "There is a dispute that requires police assistance",
    "My complaint has not received a response",
    "There is dangerous driving near our school",
],
"Tamil": [
    "எங்கள் பகுதியில் நடந்த திருட்டை புகார் செய்ய விரும்புகிறேன்",
    "எங்கள் குடியிருப்பு பகுதியில் சந்தேகமான நபர் உள்ளார்",
    "எனது வாகனம் திருடப்பட்டுள்ளது",
    "நான் காவல்துறையில் புகார் அளிக்க வேண்டும்",
    "எங்கள் தெருவின் அருகே சட்டவிரோத செயல்கள் நடக்கின்றன",
    "யாரோ எனது சொத்தை சேதப்படுத்தியுள்ளனர்",
    "எனக்கு மிரட்டல் செய்தி வந்துள்ளது",
    "காவல்துறை உதவி தேவைப்படும் பிரச்சனை உள்ளது",
    "எனது புகாருக்கு இன்னும் பதில் கிடைக்கவில்லை",
    "எங்கள் பள்ளி அருகே ஆபத்தான முறையில் வாகனங்கள் ஓட்டப்படுகின்றன",
],
"Tanglish": [
    "Enga area la nadandha theft ah complaint panna venum",
    "Enga residential area pakkathula suspicious person irukkaru",
    "En vehicle thirudappattuduchu",
    "Police complaint file panna venum",
    "Enga street pakkathula illegal activity nadakkudhu",
    "Yaaro en property ah damage pannirukanga",
    "Enakku threatening message vandhirukku",
    "Police assistance thevai padra dispute irukku",
    "En complaint ku response innum varala",
    "Enga school pakkathula dangerous driving nadakkudhu",
]
},

})


# ============================================================
# GENERATE UNIQUE DATA
# ============================================================

rows = []
seen = set()

priority_words = {

    "Low": [
        "information",
        "general request",
        "minor issue",
    ],

    "Medium": [
        "service delay",
        "ongoing problem",
        "local issue",
    ],

    "High": [
        "urgent problem",
        "serious issue",
        "immediate attention needed",
    ],

    "Critical": [
        "emergency situation",
        "dangerous situation",
        "immediate emergency",
    ],
}


def choose_priority(text, department):

    urgent_words = [
        "emergency",
        "dangerous",
        "threat",
        "stolen",
        "no electricity",
        "no water",
        "no medicines",
        "fire",
        "accident",
        "collapse",
    ]

    if any(word.lower() in text.lower()
           for word in urgent_words):

        return random.choice(["High", "Critical"])

    return random.choice(
        ["Low", "Medium", "Medium", "High"]
    )


for department, languages in DATA.items():

    base_examples = []

    for language, examples in languages.items():

        for example in examples:

            base_examples.append(
                (language, example)
            )


    # Generate variations until target reached

    attempts = 0

    while sum(
        1 for row in rows
        if row[1] == department
    ) < TARGET_PER_DEPARTMENT:

        attempts += 1

        if attempts > 100000:

            raise RuntimeError(
                f"Could not generate enough unique "
                f"examples for {department}"
            )

        language, base = random.choice(
            base_examples
        )

        # Different harmless variations
        prefixes = {

            "English": [
                "",
                "Please help. ",
                "I want to report that ",
                "I would like to complain that ",
                "Kindly look into this: ",
            ],

            "Tamil": [
                "",
                "தயவுசெய்து உதவுங்கள். ",
                "இந்த பிரச்சனை குறித்து புகார் அளிக்கிறேன்: ",
                "தயவுசெய்து இதை சரி செய்யுங்கள். ",
                "இந்த பிரச்சனையை கவனிக்கவும்: ",
            ],

            "Tanglish": [
                "",
                "Please help. ",
                "Indha problem pathi complaint panren: ",
                "Kindly idha solve pannunga. ",
                "Indha issue ah check pannunga: ",
            ],
        }

        prefix = random.choice(
            prefixes[language]
        )

        text = prefix + base

        # Add optional ending
        endings = {

            "English": [
                "",
                " Please take necessary action.",
                " Kindly resolve this issue.",
                " Please look into this matter.",
            ],

            "Tamil": [
                "",
                " தயவுசெய்து தேவையான நடவடிக்கை எடுக்கவும்.",
                " தயவுசெய்து இந்த பிரச்சனையை தீர்க்கவும்.",
                " இந்த பிரச்சனையை கவனிக்கவும்.",
            ],

            "Tanglish": [
                "",
                " Please necessary action edunga.",
                " Kindly indha issue ah solve pannunga.",
                " Idha konjam check pannunga.",
            ],
        }

        text += random.choice(
            endings[language]
        )

        normalized = text.strip().lower()

        if normalized in seen:
            continue

        seen.add(normalized)

        priority = choose_priority(
            text,
            department
        )

        rows.append([
            text.strip(),
            department,
            priority
        ])


# ============================================================
# SHUFFLE
# ============================================================

random.shuffle(rows)


# ============================================================
# SAVE
# ============================================================

OUTPUT.parent.mkdir(
    parents=True,
    exist_ok=True
)

with open(
    OUTPUT,
    "w",
    encoding="utf-8",
    newline=""
) as file:

    writer = csv.writer(file)

    writer.writerow([
        "text",
        "department",
        "priority"
    ])

    writer.writerows(rows)


# ============================================================
# SUMMARY
# ============================================================

print("=" * 70)
print("CIVICAI NEXUS DATASET GENERATED")
print("=" * 70)

print(f"\nOutput: {OUTPUT}")
print(f"Total rows: {len(rows)}")

print(
    f"Departments: "
    f"{len(DATA)}"
)

print(
    f"Rows per department: "
    f"{TARGET_PER_DEPARTMENT}"
)

print("\nDataset ready for training!")