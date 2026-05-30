"""
Seed data: demo user + starter vocabulary for all supported language pairs.
Run with:  python seed_data.py
"""
from database import SessionLocal, engine
from models import Base, User, VocabularyWord
import datetime

Base.metadata.create_all(bind=engine)

DEMO_WORDS = [
    # de → en
    ("de", "en", "der Hund",       "the dog",        "noun",       "Der Hund bellt laut.",            "The dog barks loudly."),
    ("de", "en", "die Katze",      "the cat",        "noun",       "Die Katze schläft auf dem Sofa.", "The cat sleeps on the sofa."),
    ("de", "en", "das Haus",       "the house",      "noun",       "Das Haus ist groß.",              "The house is big."),
    ("de", "en", "schreiben",      "to write",       "verb",       "Ich schreibe einen Brief.",       "I am writing a letter."),
    ("de", "en", "laufen",         "to run",         "verb",       "Er läuft jeden Morgen.",          "He runs every morning."),
    ("de", "en", "schön",          "beautiful",      "adjective",  "Das ist ein schöner Tag.",        "That is a beautiful day."),
    ("de", "en", "schnell",        "fast",           "adjective",  "Das Auto ist sehr schnell.",      "The car is very fast."),
    ("de", "en", "der Apfel",      "the apple",      "noun",       "Ich esse einen Apfel.",           "I am eating an apple."),
    ("de", "en", "trinken",        "to drink",       "verb",       "Sie trinkt Kaffee.",              "She drinks coffee."),
    ("de", "en", "die Arbeit",     "the work",       "noun",       "Die Arbeit macht Spaß.",          "Work is fun."),
    # de → es
    ("de", "es", "der Hund",       "el perro",       "noun",       "Der Hund bellt.",                 "El perro ladra."),
    ("de", "es", "die Katze",      "el gato",        "noun",       "Die Katze schläft.",              "El gato duerme."),
    ("de", "es", "das Wasser",     "el agua",        "noun",       "Ich trinke Wasser.",              "Bebo agua."),
    ("de", "es", "schön",          "bonito/a",       "adjective",  "Es ist schön hier.",              "Es bonito aquí."),
    ("de", "es", "essen",          "comer",          "verb",       "Wir essen zusammen.",             "Comemos juntos."),
    ("de", "es", "die Sonne",      "el sol",         "noun",       "Die Sonne scheint.",              "El sol brilla."),
    ("de", "es", "kaufen",         "comprar",        "verb",       "Ich kaufe Brot.",                 "Compro pan."),
    # de → fr
    ("de", "fr", "das Buch",       "le livre",       "noun",       "Das Buch ist interessant.",       "Le livre est intéressant."),
    ("de", "fr", "die Stadt",      "la ville",       "noun",       "Die Stadt ist groß.",             "La ville est grande."),
    ("de", "fr", "lernen",         "apprendre",      "verb",       "Ich lerne Französisch.",          "J'apprends le français."),
    ("de", "fr", "gut",            "bon/bonne",      "adjective",  "Das Essen ist gut.",              "La nourriture est bonne."),
    ("de", "fr", "das Geld",       "l'argent",       "noun",       "Ich brauche Geld.",               "J'ai besoin d'argent."),
    # en → es
    ("en", "es", "the beach",      "la playa",       "noun",       "I love the beach.",               "Me encanta la playa."),
    ("en", "es", "to travel",      "viajar",         "verb",       "I want to travel.",               "Quiero viajar."),
    ("en", "es", "happy",          "feliz",          "adjective",  "I am very happy.",                "Estoy muy feliz."),
    ("en", "es", "the friend",     "el amigo",       "noun",       "He is my best friend.",           "Es mi mejor amigo."),
    ("en", "es", "to speak",       "hablar",         "verb",       "Can you speak slower?",           "¿Puedes hablar más despacio?"),
    # en → fr
    ("en", "fr", "the train",      "le train",       "noun",       "The train is late.",              "Le train est en retard."),
    ("en", "fr", "to cook",        "cuisiner",       "verb",       "I love to cook.",                 "J'adore cuisiner."),
    ("en", "fr", "beautiful",      "beau/belle",     "adjective",  "What a beautiful view!",          "Quelle belle vue !"),
    # de → sv
    ("de", "sv", "das Auto",       "bilen",          "noun",       "Das Auto ist rot.",               "Bilen är röd."),
    ("de", "sv", "die Familie",    "familjen",       "noun",       "Meine Familie ist groß.",         "Min familj är stor."),
    ("de", "sv", "sprechen",       "tala",           "verb",       "Ich spreche Deutsch.",            "Jag talar tyska."),
    # de → pl
    ("de", "pl", "guten Morgen",   "dzień dobry",    "phrase",     "Guten Morgen! Wie geht es dir?", "Dzień dobry! Jak się masz?"),
    ("de", "pl", "das Brot",       "chleb",          "noun",       "Ich esse Brot zum Frühstück.",    "Jem chleb na śniadanie."),
    ("de", "pl", "danke",          "dziękuję",       "phrase",     "Danke für deine Hilfe.",          "Dziękuję za pomoc."),
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
            for src, tgt, word, trans, pos, ex, ex_t in DEMO_WORDS:
                db.add(VocabularyWord(
                    user_id=user.id,
                    source_language=src,
                    target_language=tgt,
                    word=word,
                    translation=trans,
                    part_of_speech=pos,
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
