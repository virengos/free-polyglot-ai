"""
Seed data: demo user + starter vocabulary for all supported language pairs.
Run with:  python seed_data.py
"""
from database import SessionLocal, engine
from models import Base, User, VocabularyWord
import datetime

Base.metadata.create_all(bind=engine)

DEMO_WORDS = [
    # (src, tgt, word, translation, part_of_speech, category, example, example_translation)
    # de → en
    ("de", "en", "der Hund",       "the dog",        "noun",       "animals",   "Der Hund bellt laut.",            "The dog barks loudly."),
    ("de", "en", "die Katze",      "the cat",        "noun",       "animals",   "Die Katze schläft auf dem Sofa.", "The cat sleeps on the sofa."),
    ("de", "en", "das Haus",       "the house",      "noun",       "household", "Das Haus ist groß.",              "The house is big."),
    ("de", "en", "schreiben",      "to write",       "verb",       "verbs",     "Ich schreibe einen Brief.",       "I am writing a letter."),
    ("de", "en", "laufen",         "to run",         "verb",       "sports",    "Er läuft jeden Morgen.",          "He runs every morning."),
    ("de", "en", "schön",          "beautiful",      "adjective",  "adjectives","Das ist ein schöner Tag.",        "That is a beautiful day."),
    ("de", "en", "schnell",        "fast",           "adjective",  "adjectives","Das Auto ist sehr schnell.",      "The car is very fast."),
    ("de", "en", "der Apfel",      "the apple",      "noun",       "food",      "Ich esse einen Apfel.",           "I am eating an apple."),
    ("de", "en", "trinken",        "to drink",       "verb",       "food",      "Sie trinkt Kaffee.",              "She drinks coffee."),
    ("de", "en", "die Arbeit",     "the work",       "noun",       "work",      "Die Arbeit macht Spaß.",          "Work is fun."),
    # de → es
    ("de", "es", "der Hund",       "el perro",       "noun",       "animals",   "Der Hund bellt.",                 "El perro ladra."),
    ("de", "es", "die Katze",      "el gato",        "noun",       "animals",   "Die Katze schläft.",              "El gato duerme."),
    ("de", "es", "das Wasser",     "el agua",        "noun",       "food",      "Ich trinke Wasser.",              "Bebo agua."),
    ("de", "es", "schön",          "bonito/a",       "adjective",  "adjectives","Es ist schön hier.",              "Es bonito aquí."),
    ("de", "es", "essen",          "comer",          "verb",       "food",      "Wir essen zusammen.",             "Comemos juntos."),
    ("de", "es", "die Sonne",      "el sol",         "noun",       "nature",    "Die Sonne scheint.",              "El sol brilla."),
    ("de", "es", "kaufen",         "comprar",        "verb",       "shopping",  "Ich kaufe Brot.",                 "Compro pan."),
    # de → fr
    ("de", "fr", "das Buch",       "le livre",       "noun",       "education", "Das Buch ist interessant.",       "Le livre est intéressant."),
    ("de", "fr", "die Stadt",      "la ville",       "noun",       "travel",    "Die Stadt ist groß.",             "La ville est grande."),
    ("de", "fr", "lernen",         "apprendre",      "verb",       "education", "Ich lerne Französisch.",          "J'apprends le français."),
    ("de", "fr", "gut",            "bon/bonne",      "adjective",  "adjectives","Das Essen ist gut.",              "La nourriture est bonne."),
    ("de", "fr", "das Geld",       "l'argent",       "noun",       "shopping",  "Ich brauche Geld.",               "J'ai besoin d'argent."),
    # en → es
    ("en", "es", "the beach",      "la playa",       "noun",       "travel",    "I love the beach.",               "Me encanta la playa."),
    ("en", "es", "to travel",      "viajar",         "verb",       "travel",    "I want to travel.",               "Quiero viajar."),
    ("en", "es", "happy",          "feliz",          "adjective",  "emotions",  "I am very happy.",                "Estoy muy feliz."),
    ("en", "es", "the friend",     "el amigo",       "noun",       "people",    "He is my best friend.",           "Es mi mejor amigo."),
    ("en", "es", "to speak",       "hablar",         "verb",       "verbs",     "Can you speak slower?",           "¿Puedes hablar más despacio?"),
    # en → fr
    ("en", "fr", "the train",      "le train",       "noun",       "travel",    "The train is late.",              "Le train est en retard."),
    ("en", "fr", "to cook",        "cuisiner",       "verb",       "food",      "I love to cook.",                 "J'adore cuisiner."),
    ("en", "fr", "beautiful",      "beau/belle",     "adjective",  "adjectives","What a beautiful view!",          "Quelle belle vue !"),
    # de → sv
    ("de", "sv", "das Auto",       "bilen",          "noun",       "travel",    "Das Auto ist rot.",               "Bilen är röd."),
    ("de", "sv", "die Familie",    "familjen",       "noun",       "people",    "Meine Familie ist groß.",         "Min familj är stor."),
    ("de", "sv", "sprechen",       "tala",           "verb",       "verbs",     "Ich spreche Deutsch.",            "Jag talar tyska."),
    # de → pl
    ("de", "pl", "guten Morgen",   "dzień dobry",    "phrase",     "phrases",   "Guten Morgen! Wie geht es dir?", "Dzień dobry! Jak się masz?"),
    ("de", "pl", "das Brot",       "chleb",          "noun",       "food",      "Ich esse Brot zum Frühstück.",    "Jem chleb na śniadanie."),
    ("de", "pl", "danke",          "dziękuję",       "phrase",     "phrases",   "Danke für deine Hilfe.",          "Dziękuję za pomoc."),
]


def seed():
    db = SessionLocal()
    try:
        # Demo user
        user = db.query(User).filter(User.email == "demo@polyglot.ai").first()
        if not user:
            user = User(
                username="polyglot_demo",
                email="demo@polyglot.ai",
                native_language="de",
                target_languages=["en", "es", "fr", "sv", "pl"],
                xp=350,
                level=2,
                streak_days=3,
            )
            db.add(user)
            db.flush()
            print(f"Created demo user (id={user.id})")
        else:
            print(f"Demo user already exists (id={user.id})")

        # Words
        existing = db.query(VocabularyWord).filter(VocabularyWord.user_id == user.id).count()
        if existing == 0:
            for src, tgt, word, trans, pos, cat, ex, ex_t in DEMO_WORDS:
                db.add(VocabularyWord(
                    user_id=user.id,
                    source_language=src,
                    target_language=tgt,
                    word=word,
                    translation=trans,
                    part_of_speech=pos,
                    category=cat,
                    example_sentence=ex,
                    example_translation=ex_t,
                ))
            print(f"Seeded {len(DEMO_WORDS)} vocabulary words")
        else:
            print(f"Vocabulary already seeded ({existing} words)")

        db.commit()
        print("Done. User ID:", user.id)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
