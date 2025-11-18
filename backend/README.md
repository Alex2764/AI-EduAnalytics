# School Test Program - Backend API

Backend API за генериране на AI-анализи на тестове с помощта на Google Gemini AI.

## 🔧 Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

### Required Variables

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `GEMINI_API_KEY` | Google Gemini AI API key | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `SUPABASE_URL` | Your Supabase project URL | [Supabase Dashboard → Settings → API](https://supabase.com/dashboard) |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | [Supabase Dashboard → Settings → API](https://supabase.com/dashboard) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8000` |
| `HOST` | Server host | `0.0.0.0` |
| `CLEANUP_API_KEY` | API key for cleanup endpoint protection | `None` (disabled) |

### Setup Instructions

1. Copy the example file:

```bash
cp .env.example .env
```

2. Edit `.env` and add your real credentials:

```bash
nano .env
# or
code .env
```

## Структура на проекта

```
backend/
├── main.py                    # FastAPI приложение
├── services/
│   ├── gemini_service.py      # Интеграция с Gemini AI
│   ├── document_service.py    # Създаване на Word документи
│   └── supabase_service.py    # Интеграция с Supabase
├── templates/                 # Шаблони за документи
├── output/                    # Генерирани документи (създава се автоматично)
├── .env                       # Environment variables
└── requirements.txt           # Python зависимости
```

## Инсталация

1. Създай виртуална среда:
```bash
python -m venv venv
source venv/bin/activate  # На Windows: venv\Scripts\activate
```

2. Инсталирай зависимостите:
```bash
pip install -r requirements.txt
```

3. Настрой `.env` файла (виж секцията "🔧 Environment Variables" по-горе)

## Стартиране

```bash
python main.py
```

Или с uvicorn директно:
```bash
uvicorn main:app --reload --port 8000
```

API ще бъде достъпно на: `http://localhost:8000`

## API Endpoints

### GET `/`
Основна информация за API-то

### GET `/health`
Health check endpoint

### POST `/api/generate-report`
Генерира AI анализ на тест и връща Word документ за изтегляне.

**Забележка:** Шаблонът, който се използва, е default шаблонът, зададен в AI Settings. За промяна на шаблона използвай `/api/templates` endpoints.

**Request Body:**
```json
{
  "test_id": "test-uuid-here",
  "class_id": "class-uuid-here",
  "teacher_name": "Име на преподавател (опционално)"
}
```

**Response:**
Word документ (.docx) за изтегляне

**Пример с curl:**
```bash
curl -X POST "http://localhost:8000/api/generate-report" \
  -H "Content-Type: application/json" \
  -d '{
    "test_id": "test-uuid-here",
    "class_id": "class-uuid-here"
  }' \
  --output analysis.docx
```

### POST `/api/cleanup`
Изчиства стари генерирани документи.

**Забележка:** Ако е зададен `CLEANUP_API_KEY` в `.env`, endpoint-ът изисква автентикация.

**Параметри:**
- `max_age_hours` (query parameter) - Максимална възраст на файловете в часове (по подразбиране: 24)

**Ако е защитен с API key:**
```bash
curl -X POST "http://localhost:8000/api/cleanup?max_age_hours=24" \
  -H "X-API-Key: your_secret_cleanup_key_here"
```

**Ако НЕ е защитен (development):**
```bash
curl -X POST "http://localhost:8000/api/cleanup?max_age_hours=24"
```

**Response:**
```json
{
  "status": "success",
  "removed_count": 5,
  "max_age_hours": 24
}
```

### GET `/api/templates`
Получава списък с всички налични шаблони.

**Response:**
```json
[
  {
    "name": "test_analysis_template.docx",
    "is_default": true,
    "size": 24576
  },
  {
    "name": "custom_template.docx",
    "is_default": false,
    "size": 32800
  }
]
```

### POST `/api/templates/upload`
Качва нов шаблон файл.

**Request:**
- `file` (multipart/form-data) - Word документ (.docx), максимум 10MB

**Пример с curl:**
```bash
curl -X POST "http://localhost:8000/api/templates/upload" \
  -F "file=@/path/to/template.docx"
```

**Response:**
```json
{
  "status": "success",
  "message": "Template 'template.docx' uploaded successfully",
  "template_name": "template.docx",
  "size": 24576
}
```

### GET `/api/templates/default`
Получава текущ default шаблон.

**Response:**
```json
{
  "default_template": "test_analysis_template.docx",
  "exists": true,
  "path": "/path/to/templates/test_analysis_template.docx"
}
```

### POST `/api/templates/default`
Задава default шаблон (използва се при генериране на доклади).

**Request Body:**
```json
{
  "template_name": "test_analysis_template.docx"
}
```

**Пример с curl:**
```bash
curl -X POST "http://localhost:8000/api/templates/default" \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "test_analysis_template.docx"
  }'
```

**Response:**
```json
{
  "status": "success",
  "message": "Default template set to 'test_analysis_template.docx'",
  "default_template": "test_analysis_template.docx"
}
```

### DELETE `/api/templates/{template_name}`
Изтрива шаблон файл.

**Забележка:** Не може да се изтрие default шаблонът. Първо трябва да зададеш друг шаблон като default.

**Пример с curl:**
```bash
curl -X DELETE "http://localhost:8000/api/templates/custom_template.docx"
```

**Response:**
```json
{
  "status": "success",
  "message": "Template 'custom_template.docx' deleted successfully"
}
```

## Разработка

За да добавиш нови функционалности:

1. Добави нови endpoints в `main.py`
2. Разшири services в `services/` папката
3. Тествай с Postman или curl

## Безопасност

### 🔐 За Production:

1. **Cleanup Endpoint Protection:**
   - Задай `CLEANUP_API_KEY` в environment variables
   - Endpoint-ът ще изисква `X-API-Key` header за достъп
   - Без API key endpoint-ът е отворен (само за development)

   ```bash
   # В .env файла
   CLEANUP_API_KEY=your_secret_cleanup_key_here
   ```

2. **CORS Configuration:**
   - Обнови `allow_origins` в `main.py` с production URLs
   - Премахни или ограничи localhost origins

3. **Environment Variables:**
   - Използвай environment variables вместо `.env` файл
   - Никога не commit-вай `.env` файл в git!

## Забележки

- Генерираните документи се запазват в `output/` папката
- Старите документи могат да се изчистват автоматично с `/api/cleanup`
- API документация е достъпна на: `http://localhost:8000/docs`
- Health check endpoint: `http://localhost:8000/health`

