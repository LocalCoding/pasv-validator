# pasv-validator

Сервис валидации кода студентов для платформы PASV. Запускает пользовательский JavaScript-код в изолированной V8 среде (isolated-vm) и возвращает результаты тестов на backend.

## Архитектура

```
Client (coding.pasv.us) → Backend (server-prod.pasv.us) → Validator (validator.pasv.us)
                                        ↑                          │
                                        └──────── callback ────────┘
```

1. Студент отправляет решение через клиент
2. Backend отправляет POST-запрос на валидатор с кодом решения и тестами
3. Валидатор запускает код в V8 isolate, собирает результаты
4. Валидатор сразу отвечает `200 OK` бэкенду ("контейнер создан")
5. Параллельно отправляет callback с результатами на `POST /validation/receive/result`

## API

### `GET /test`
Health check. Возвращает `{ status: "ok", uptime: 123.45 }`.

### `POST /validate/unit/place`
Запуск JS-кода с тестами в V8 isolate.

**Request body:**
```json
{
  "solution": "function sum(a, b) { return a + b; }",
  "test": "describe('sum', () => { it('adds', () => { expect(sum(1,2)).to.equal(3); }); });",
  "userId": "abc123",
  "challengeId": "def456",
  "programmingLang": "JavaScript"
}
```

- `solution` — код студента
- `test` — тесты в формате describe/it/expect (Chai-совместимый синтаксис)
- `userId`, `challengeId` — для callback на backend
- `programmingLang` — пока поддерживается только `"JavaScript"`

**Response (мгновенный):**
```json
{
  "success": true,
  "message": "Container has been created and result has been sent.",
  "payload": null
}
```

Результаты тестов отправляются асинхронно на backend через callback (см. `src/callback.js`).

### `POST /validate/equal`
Простое сравнение строк (для заданий типа "напиши точно как в примере").

**Request body:**
```json
{
  "solution": "const x = 5;",
  "completedSolution": "const x = 5;"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Everything is good",
  "payload": [{ "type": "passed" }]
}
```

Возможные warnings в payload: `notEqual`, `semicolon`, `checkSpaces`, `noVar`, `letConst`, `constLet`.

## Безопасность и лимиты

### V8 Isolate (isolated-vm)
- **Память:** 32 MB на isolate
- **Таймаут:** 10 секунд на выполнение
- Код запускается в полностью изолированном V8 контексте — нет доступа к Node.js API, файловой системе, сети
- Каждый запрос создаёт новый isolate, после выполнения он уничтожается (`isolate.dispose()`)

### Бесконечный цикл
Если студент напишет `while(true) {}`, isolated-vm прервёт выполнение через 10 секунд по таймауту. Isolate будет уничтожен, сервер продолжит работу. Ответ с ошибкой уйдёт на backend через callback.

### Ошибки в коде студента
- Синтаксическая ошибка в `solution` → возвращается `terminal` error, `isPassed: false`
- Синтаксическая ошибка в `test` → аналогично
- Runtime error → перехватывается, возвращается как terminal error

### Размер запроса
Express ограничивает body до 1 MB (`express.json({ limit: '1mb' })`).

## Callback на backend

После выполнения тестов валидатор отправляет результаты на backend (`src/callback.js`):

- **prod:** `https://server-prod.pasv.us/validation/receive/result`
- **local:** `http://localhost:5000/validation/receive/result`

Формат payload — массив JSON-строк (совместимость со старым валидатором):
```json
[
  "{\"event\":\"start\",\"payload\":{\"userId\":\"...\",\"challengeId\":\"...\",\"solution\":\"...\"}}",
  "{\"event\":\"pass\",\"payload\":{\"title\":\"...\",\"fullTitle\":\"...\",\"duration\":5}}",
  "{\"event\":\"end\",\"payload\":{\"tests\":1,\"passes\":1}}"
]
```

Callback отправляется асинхронно — ответ клиенту не ждёт его завершения. Ошибки callback логируются, но не влияют на ответ.

## Встроенный тест-фреймворк

Внутри isolate доступны `describe()`, `it()`, `expect()` с Chai-совместимым API:

- `.to.equal()`, `.to.deep.equal()`, `.to.eql()`
- `.to.be.true`, `.to.be.false`, `.to.be.null`, `.to.be.undefined`, `.to.be.NaN`
- `.to.be.ok`, `.to.exist`
- `.to.be.a('string')`, `.to.be.an('array')`
- `.to.include()`, `.to.contain()`
- `.to.have.length()`, `.to.have.lengthOf()`
- `.to.have.property()`
- `.to.be.above()`, `.to.be.below()`, `.to.be.at.least()`, `.to.be.at.most()`
- `.to.throw()`, `.to.match()`, `.to.satisfy()`
- `.to.have.members()`, `.to.have.keys()`
- `.to.be.oneOf()`
- `.to.be.an.instanceOf()`
- `.not` — инверсия: `.to.not.equal()`

## Запуск

### Локально
```bash
npm install
npm run dev          # nodemon, hot-reload
npm start            # production
```

Переменные окружения:
- `PORT` — порт (по умолчанию 7000)
- `NODE_ENV` — `local` для callback на localhost:5000, `prod` для production

### Docker
```bash
docker build -t pasv-validator .
docker run -p 7000:7000 -e NODE_ENV=prod pasv-validator
```

### Тесты
```bash
npm test
```
Тесты используют fixtures из `pasv-validator-dockerized/test-data/` (соседний репозиторий).

## Деплой

Деплоится на **Coolify** (OVH сервер) автоматически из GitHub.

- **URL:** https://validator.pasv.us
- **Coolify UUID:** `egkw808sgkgs0gcc0ckk4gcc`
- **Порт:** 7000

### Рестарт при падении
Coolify автоматически перезапускает контейнер при падении (Docker restart policy). Health check доступен на `GET /test`.

## Структура файлов

```
src/
  index.js            — Express-сервер, роуты
  isolate-runner.js   — Запуск кода в V8 isolate + встроенный тест-фреймворк
  equal-validator.js  — Простое сравнение строк
  callback.js         — Отправка результатов на backend
test/
  run.js              — Тест-раннер (fixtures из pasv-validator-dockerized)
Dockerfile            — Production образ (node:18-slim + build tools для isolated-vm)
```

## Отличия от старого валидатора (pasv-validator-dockerized)

| | Старый (Docker) | Новый (isolated-vm) |
|---|---|---|
| Изоляция | Docker-контейнер на каждый запрос | V8 isolate |
| Скорость | ~3700ms avg | ~84ms avg (в 50 раз быстрее) |
| Тест-фреймворк | Mocha + Chai (npm) | Встроенный мини-фреймворк |
| Инфра | AWS EC2 Auto Scaling + ELB | Один контейнер на Coolify |
| Масштабирование | Горизонтальное (EC2) | Вертикальное (один процесс) |
