# Исправление сборки `@eidos/workspace` в CI (`pnpm turbo run build`)

Устранение ошибки `Could not resolve entry module "index.html"` при выполнении `pnpm turbo run build` в пакете `@eidos/workspace`, а также обеспечение полной воспроизводимости продакшн-сборки всех 6 пакетов монорепозитория (`@eidos/sdk`, `@eidos/core`, `@eidos/api`, `@eidos/demo`, `@eidos/landing`, `@eidos/workspace`).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Причина падения CI однозначно локализована по логам: при вызове `vite build` в директории пакета `@eidos/workspace` отсутствует входная точка `index.html` и конфигурационный файл `vite.config.ts`. План готов к немедленному выполнению после подтверждения (**Proceed**).

- **Confirmed Decision 1**: Создать стандартизированный входной HTML-модуль и конфигурацию сборщика Vite для `@eidos/workspace`, подключив точку входа React-приложения (`/src/main.tsx`), мета-теги SEO/OpenGraph, шрифты (`Inter` + `JetBrains Mono`) и полифиллы окружения браузера.
- **Confirmed Decision 2**: Настроить разрешение воркспейс-зависимостей (`@eidos/core`, `@eidos/sdk`) и автоматическую JSX-трансформацию (`esbuild: { jsx: 'automatic' }`), чтобы `vite build` проходил автономно в изолированном окружении GitHub Actions Runner.

---

## 1. Overview & Core Concept

- **What It Does**: Восстанавливает сборку веб-консоли `@eidos/workspace` в рамках пайплайна Turborepo (`pnpm turbo run build`), создавая недостающий входной HTML-документ, конфигурацию сборщика Vite и проверяя прохождение сборки всех пакетов монорепозитория.
- **Target Audience / Persona**: Инженеры и CI/CD пайплайн GitHub Actions, выполняющие автоматическую проверку и сборку артефактов монорепозитория при каждом коммите и пулл-реквесте.
- **Key Value**: Полностью зелёный шаг `pnpm turbo run build` (6 из 6 успешных задач в Turborepo) без падений на `Could not resolve entry module "index.html"`.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. Разработчик или CI запускает `pnpm turbo run build`.
  2. Turborepo собирает `@eidos/sdk` и `@eidos/core`, после чего запускает параллельную сборку `@eidos/workspace`, `@eidos/api`, `@eidos/demo` и `@eidos/landing`.
  3. Сборщик Vite в `@eidos/workspace` находит входной `index.html`, бандлит дерево компонентов React и генерирует оптимизированные продакшн-ассеты в `dist/`.
- **Visual Identity & Theme**:
  - Заголовок, мета-описание и предзагрузка шрифтов (`Inter`, `JetBrains Mono`) в `@eidos/workspace` полностью синхронизированы с дизайн-системой EIDOS.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Автономная конфигурация Vite с `esbuild` JSX Automatic Runtime**:
  - *Chosen Approach*: Настроить `esbuild: { jsx: 'automatic' }` и алиасы на `@eidos/core` и `@eidos/sdk` непосредственно в конфигурации Vite пакета `@eidos/workspace`, а также добавить `@xenova/transformers` и `recharts` в зависимости пакета при необходимости.
  - *Why*: Не требует внешних плагинов, чувствительных к версиям в монорепозитории, и гарантирует быструю и детерминированную сборку Rollup/Vite.
  - *Alternatives Considered*: Исключение `@eidos/workspace` из области видимости Turborepo — отклонено, так как веб-консоль должна собираться как полноценный артефакт монорепозитория.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        pnpm turbo run build                             │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
      ┌───────────────────────┐           ┌───────────────────────┐
      │   @eidos/core:build   │           │   @eidos/sdk:build    │
      └───────────┬───────────┘           └───────────┬───────────┘
                  └─────────────────┬─────────────────┘
                                    │
        ┌───────────────────┬───────┴───────────┬───────────────────┐
        ▼                   ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│@eidos/api     │   │@eidos/demo    │   │@eidos/landing │   │@eidos/workspace│
│(tsc -> dist/) │   │(vite -> dist/)│   │(next -> out/) │   │(vite -> dist/)│
└───────────────┘   └───────────────┘   └───────────────┘   └───────┬───────┘
                                                                    │
                                                     ┌──────────────┴──────────────┐
                                                     │ index.html + vite.config.ts │
                                                     │      -> /src/main.tsx       │
                                                     └─────────────────────────────┘
```

- **Data Model & State**: Изменения затрагивают исключительно конфигурацию сборки и входной HTML-модуль пакета `@eidos/workspace` без изменения бизнес-логики алгоритмов.
- **Verification**: После внесения изменений будет выполнен тестовый прогон сборки `vite build` для `@eidos/workspace` и общая проверка компиляции проекта.
