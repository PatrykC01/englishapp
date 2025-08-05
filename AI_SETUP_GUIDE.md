# 🤖 Przewodnik konfiguracji AI dla aplikacji do nauki angielskiego

## Przegląd funkcji AI

Twoja aplikacja została rozszerzona o zaawansowane funkcje AI, które znacznie poprawią proces nauki:

### 🎯 Główne funkcje AI:
1. **Inteligentne generowanie słów** - AI tworzy spersonalizowane słownictwo na podstawie Twojego poziomu i postępów
2. **Adaptacyjne interwały powtórek** - AI optymalizuje harmonogram nauki na podstawie Twoich wyników
3. **Analiza wzorców nauki** - System śledzi Twoje mocne i słabe strony
4. **Personalizowane rekomendacje** - AI dostosowuje trudność i kategorie słów do Twoich potrzeb

## 🔧 Konfiguracja AI

### Krok 1: Wybór dostawcy AI
Aplikacja obsługuje trzech głównych dostawców AI:

#### OpenAI (Rekomendowane)
- **Modele**: GPT-3.5 Turbo, GPT-4, GPT-4 Turbo
- **Zalety**: Najlepsza jakość generowania słów, szybkie odpowiedzi
- **Koszt**: Średni (pay-per-use)
- **Jak uzyskać klucz**: https://platform.openai.com/api-keys

#### Anthropic (Claude)
- **Modele**: Claude 3 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **Zalety**: Bardzo dobre zrozumienie kontekstu, bezpieczne odpowiedzi
- **Koszt**: Średni do wysokiego
- **Jak uzyskać klucz**: https://console.anthropic.com/

#### Google (Gemini)
- **Modele**: Gemini Pro, Gemini Pro Vision
- **Zalety**: Darmowy limit, dobra integracja z Google
- **Koszt**: Darmowy limit, potem płatny
- **Jak uzyskać klucz**: https://makersuite.google.com/app/apikey

### Krok 2: Uzyskanie klucza API

#### Dla OpenAI:
1. Zarejestruj się na https://platform.openai.com/
2. Przejdź do sekcji "API Keys"
3. Kliknij "Create new secret key"
4. Skopiuj klucz (zaczyna się od `sk-`)

#### Dla Anthropic:
1. Zarejestruj się na https://console.anthropic.com/
2. Przejdź do sekcji "API Keys"
3. Utwórz nowy klucz
4. Skopiuj klucz

#### Dla Google Gemini:
1. Przejdź do https://makersuite.google.com/app/apikey
2. Zaloguj się kontem Google
3. Utwórz nowy klucz API
4. Skopiuj klucz

### Krok 3: Konfiguracja w aplikacji
1. Otwórz aplikację i przejdź do **Ustawienia**
2. W sekcji **Konfiguracja AI**:
   - Wybierz dostawcę AI
   - Wklej swój klucz API
   - Wybierz model (rekomendacja: GPT-3.5 Turbo dla OpenAI)
   - Włącz "Inteligentne rekomendacje interwałów powtórek"
   - Włącz "Adaptacyjna trudność słów"
3. Kliknij **"Testuj połączenie AI"** aby sprawdzić konfigurację

## 💡 Jak działa AI w aplikacji

### Generowanie słów
AI analizuje:
- Twój aktualny poziom językowy (A1-C2)
- Kategorię słów (dom, praca, jedzenie, etc.)
- Twoje trudne słowa z przeszłości
- Tempo nauki i słabe obszary
- Słowa, które już znasz (aby unikać duplikatów)

### Inteligentne powtórki
AI określa optymalne interwały na podstawie:
- Historii odpowiedzi dla danego słowa
- Trudności słowa
- Twojego ogólnego tempa nauki
- Średniej dokładności odpowiedzi

### Analiza postępów
System śledzi:
- Słowa, które sprawiają Ci trudność
- Kategorie, w których radzisz sobie najlepiej/najgorzej
- Tempo nauki (szybkie/średnie/wolne)
- Wzorce błędów

## 🚀 Najlepsze praktyki

### Dla optymalnych wyników:
1. **Regularnie używaj aplikacji** - AI potrzebuje danych do analizy
2. **Bądź szczery z odpowiedziami** - nie zgaduj, jeśli nie znasz słowa
3. **Eksperymentuj z poziomami** - AI dostosuje się do Twojego tempa
4. **Sprawdzaj postępy** - sekcja "Postępy" pokazuje analizę AI

### Oszczędzanie kosztów API:
1. Zacznij od GPT-3.5 Turbo (tańszy niż GPT-4)
2. Ustaw rozsądny dzienny cel słów (5-15)
3. Używaj funkcji testowania połączenia oszczędnie
4. Rozważ Gemini Pro dla darmowego limitu

## 🔒 Bezpieczeństwo

- **Klucze API są przechowywane lokalnie** w Twojej przeglądarce
- Nie są wysyłane na żadne zewnętrzne serwery (poza oficjalnymi API)
- Możesz w każdej chwili usunąć klucz z ustawień
- Dane nauki pozostają prywatne

## 🛠️ Rozwiązywanie problemów

### "Błąd połączenia z AI"
- Sprawdź poprawność klucza API
- Upewnij się, że masz środki na koncie (OpenAI/Anthropic)
- Sprawdź limity API u dostawcy

### "Brak nowych słów do dodania"
- AI może nie znaleźć nowych słów dla Twojego poziomu
- Spróbuj zmienić kategorię lub poziom językowy
- Sprawdź czy nie osiągnąłeś limitu słów dla danej kategorii

### Słaba jakość generowanych słów
- Upewnij się, że wybrałeś odpowiedni poziom językowy
- Sprawdź czy AI ma wystarczająco danych o Twoich postępach
- Rozważ przejście na lepszy model (np. GPT-4)

## 📊 Monitorowanie kosztów

### OpenAI:
- GPT-3.5 Turbo: ~$0.002 za 1000 tokenów
- GPT-4: ~$0.03 za 1000 tokenów
- Typowe generowanie 5 słów: ~500-1000 tokenów

### Szacunkowe koszty miesięczne:
- **Lekkie użycie** (5 słów/dzień): $1-3/miesiąc
- **Średnie użycie** (15 słów/dzień): $3-8/miesiąc
- **Intensywne użycie** (30 słów/dzień): $8-15/miesiąc

## 🎉 Gotowe!

Po skonfigurowaniu AI Twoja aplikacja będzie:
- Automatycznie generować spersonalizowane słownictwo
- Optymalizować harmonogram powtórek
- Dostosowywać się do Twojego tempa nauki
- Analizować i poprawiać Twoje słabe obszary

Miłej nauki! 🚀📚