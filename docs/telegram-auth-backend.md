# Telegram Login — Backend Requirements

## Overview

The frontend uses the [Telegram Login Widget](https://core.telegram.org/widgets/login) to authenticate users. When a user clicks "Log in with Telegram," Telegram returns a signed payload to the frontend, which forwards it to your NestJS backend for verification and group membership checking.

---

## Endpoint

### `POST /api/auth/telegram`

**Request Body** (sent by the frontend):

```json
{
  "id": 123456789,
  "first_name": "John",
  "last_name": "Doe",
  "username": "johndoe",
  "photo_url": "https://t.me/i/userpic/...",
  "auth_date": 1700000000,
  "hash": "abc123def456..."
}
```

All fields come directly from Telegram's widget. `last_name`, `username`, and `photo_url` may be absent.

---

## Backend Steps

### 1. Verify the Telegram Hash

Telegram signs the payload using your **bot token**. You must verify it server-side to prevent spoofing.

**Algorithm** ([docs](https://core.telegram.org/widgets/login#checking-authorization)):

```
secret_key = SHA256(BOT_TOKEN)
data_check_string = "auth_date=...\nfirst_name=...\nid=...\n..."  // alphabetically sorted key=value pairs (excluding "hash")
computed_hash = HMAC_SHA256(secret_key, data_check_string)
```

Compare `computed_hash` with the received `hash`. Also check that `auth_date` is recent (e.g., within the last 5 minutes) to prevent replay attacks.

### 2. Check Group Membership

Use the Telegram Bot API to verify the user is a member of the class group:

```
GET https://api.telegram.org/bot<BOT_TOKEN>/getChatMember?chat_id=<GROUP_ID>&user_id=<USER_ID>
```

**Allow** if `status` is one of: `creator`, `administrator`, `member`, `restricted` (if `is_member` is true).

**Deny** if `status` is `left`, `kicked`, or the request fails.

> **Prerequisite:** The bot must be an **admin** in the target Telegram group.

### 3. Check Internal User Status

Look up the user by `telegram_id` in your database:

- If **banned** → respond with denied reason
- If **suspended** and suspension is still active → respond with denied reason + `suspendedUntil`
- If not found → **create** a new user record (auto-registration)

### 4. Return Response

**Success (200):**

```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "",
    "initials": "JD",
    "phone": "",
    "role": "student",
    "code": "12345",
    "year": 1,
    "semester": 1,
    "batch": "",
    "anonymous_id": "Anon#XXXX",
    "telegramUsername": "johndoe"
  }
}
```

The `user` object shape must match the `MockAccount` interface used by the frontend (see `src/types/auth.ts`).

**Denied — not in group (403):**

```json
{ "reason": "not_in_group" }
```

**Denied — banned (403):**

```json
{ "reason": "banned" }
```

**Denied — suspended (403):**

```json
{
  "reason": "suspended",
  "suspendedUntil": "2025-04-01T00:00:00.000Z"
}
```

**Denied — unregistered / hash invalid (401):**

```json
{ "reason": "unregistered" }
```

---

## Required Environment Variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_GROUP_ID` | Numeric chat ID of the class group (negative number for groups, e.g. `-1001234567890`) |

---

## Bot Setup Checklist

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Run `/setdomain` in BotFather and set it to your frontend's domain
3. Add the bot as an **admin** to the class Telegram group
4. Store the bot token and group ID as environment variables

---

## Optional: Group ID Management

The frontend has an owner-only setting to update the Telegram Group ID. You may want an endpoint to persist this:

### `PUT /api/settings/telegram-group`

```json
{ "groupId": "-1001234567890" }
```

Restricted to `owner` role only.
