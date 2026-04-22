# Competitive Habit Tracker — MVP PRD
**Version 1.0 · April 2026**

---

## 1. Product Vision

Build a habit tracker where competition replaces traditional streak mechanics as the primary motivation engine. Users are matched 1v1 against a stranger every week, their habit completions generate points, and the week culminates in a battle result. Winning drives rank progression. Losing drives the fear of falling behind.

**Core hypothesis to validate:**
> *Will users return daily because they do not want to lose to their opponent?*

Feel: Duolingo meets competitive gaming. Ranked progression is the reward layer. Creature/avatar evolution is deferred to post-MVP.

---

## 2. Recommended Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | PWA (Web-first) | Fastest launch, no app store delays, easy iteration |
| Backend / DB | Supabase | Auth, real-time DB, storage — all in one, minimal ops |
| Notifications | Web Push + Supabase Edge Functions | Handles daily nudge loops without a separate service |
| File Storage | Supabase Storage | For snapshot uploads from check-ins |

---

## 3. MVP Features

The following 6 features constitute the complete MVP scope. Nothing outside this list should be built before validation.

---

### 3.1 Weekly Matchmaking

- Users are matched against a random stranger at the start of every week (Monday 00:00 user local time).
- Matching is purely random in MVP — no skill-based bucketing. Skill-weighted matching is a post-MVP improvement once the user pool grows.
- Friend invites are supported as a growth/referral mechanism only — not as a game mode. Friends do not compete against each other.
- Each user has exactly one active duel per week. No multi-match support in MVP.
- If the pool has an odd number of users, hold the extra user in queue and match them as soon as the next user registers.

---

### 3.2 Habit Selection

- At the start of each week, users choose 1–5 habits from a fixed predefined list of categories.
- Each habit has a target weekly frequency (e.g., Gym: 5x/week, Meditation: 7x/week).

**Predefined Habit Categories (MVP)**

| Category | Example Target Frequency |
|---|---|
| Fitness | 3–5 sessions/week |
| Study | 5–7 sessions/week |
| Deep Work | 5 sessions/week |
| Sleep Consistency | 7 nights/week |
| Meditation | 5–7 sessions/week |
| Diet Goals | 5–7 days/week |
| Reading | 3–7 sessions/week |

- Custom habit creation is deferred to post-MVP to reduce scope and avoid gaming the scoring system.
- Difficulty weights per category are deferred to post-MVP — implement once the user base is large enough to enable fair bucketed matchmaking.

---

### 3.3 Daily Check-ins with Snapshot Verification

- Users mark each habit as complete (YES / NO) once per day.
- On approximately 50% of check-in days (randomly selected), the app prompts the user to upload a snapshot as social proof (e.g., gym selfie, study timer screenshot).
- The 50% prompt rate applies only when the user has set a minimum of 4 active habit days per week — below this threshold, no prompts are shown.
- Snapshots are visible to the opponent in a live **Evidence Feed** during the active week.
- The opponent can dispute a specific check-in. Disputed check-ins are flagged for manual review — automated dispute resolution is post-MVP.

> **Design note:** Verification is social, not technical. The opponent IS the verifier. Frame snapshot uploads as part of the competition (trash talk, motivation) — not as surveillance.

---

### 3.4 Scoring System

Each check-in contributes to a running point total visible to both players throughout the week.

| Component | Rule | Notes |
|---|---|---|
| Base Points | 10 pts per completed habit | Core unit of scoring |
| Daily Consistency Bonus | +5 pts if ALL habits completed for that day | Rewards full-day completion |
| Streak Multiplier | 1.1x after 3 consecutive days, 1.25x after 5 days | Compounding reward for sustained effort |
| Difficulty Multiplier | Deferred to post-MVP | Requires larger user pool for fair matching |

**Scoring pseudocode:**
```
daily_points = 0

for each habit completed today:
    daily_points += 10

if all habits completed today:
    daily_points += 5

if consecutive_days >= 5:
    daily_points *= 1.25
elif consecutive_days >= 3:
    daily_points *= 1.10

weekly_total += daily_points
```

- Scores update in real-time (or near real-time via Supabase subscriptions) so both players can see the live gap.
- A mid-week leaderboard snapshot is pushed as a notification on Wednesday — showing current score gap and days remaining.

---

### 3.5 Weekly Battle Result

- At week end (Sunday 23:59 user local time), the duel closes and a battle result screen is shown.
- The screen should feel like an event — animated win/loss reveal, final score breakdown, XP earned.
- Show a gap analysis for the loser: *"You needed 3 more Gym check-ins to win."* Losing with context feels recoverable. Losing with no feedback feels pointless.
- Consolation XP is awarded to the loser based on their effort (total check-ins), not just the outcome.
- Both players see each other's full week breakdown after the result is revealed.

---

### 3.6 Rank Progression System

Rank serves as the placeholder reward layer for MVP. Creature/avatar evolution, cosmetics, and seasonal themes are post-MVP.

| Rank Tier | Requirement |
|---|---|
| Bronze | Starting rank for all users |
| Silver | Win 3 duels |
| Gold | Win 7 duels |
| Platinum | Win 15 duels |
| Elite | Win 30 duels (stretch goal for MVP) |

- Losing a duel deducts rank points but does not immediately demote the rank tier — a buffer zone prevents immediate demotion (must lose 2 in a row at the bottom of a tier to drop).
- Rank is visible on the user profile and to the opponent at the start of each duel.

---

## 4. Notification Strategy

Notifications are the #1 retention mechanism. Every notification should feel like it is about your opponent, not a generic reminder.

| Trigger | Message Example | Timing |
|---|---|---|
| Opponent checks in | "Your rival just logged their workout. You're down 10 pts." | Real-time |
| User has not checked in by evening | "You haven't checked in yet today. Don't let them win this day." | 8 PM daily |
| Mid-week score gap | "Halfway through. You're trailing by 25 pts. 3 days left." | Wednesday AM |
| Opponent close to winning | "They need one more check-in to clinch it. Get moving." | Dynamic |
| Week ends in 24 hours | "Final battle tonight. Don't leave points on the board." | Sunday AM |
| New week / new duel | "Your new opponent is ready. Week starts now." | Monday AM |

- All notifications require user opt-in (Web Push permission prompt on first login).
- Users can configure quiet hours but cannot disable opponent-activity notifications entirely — this is core to the product.

---

## 5. Anti-Cheat Design

The goal is not to prevent all cheating. The goal is to make cheating feel socially costly enough that most users won't bother.

| Mechanism | How It Works | MVP? |
|---|---|---|
| Random snapshot prompts | 50% of days, prompted to upload photo proof | Yes |
| Evidence Feed | Opponent sees snapshots in real-time during the week | Yes |
| Check-in dispute | Opponent can flag a specific check-in after viewing evidence | Yes (manual review) |
| Credibility score | Users accumulate a visible trust rating; docked on confirmed flags | Post-MVP |
| AI photo verification | Automated verification of snapshot relevance | Post-MVP |

- In MVP, disputed check-ins are reviewed manually by admins. Build a simple admin dashboard for this.
- A user with 3+ confirmed flags receives a warning; 5+ flags triggers a temporary ban.

---

## 6. Out of Scope for MVP

Do not build any of the following before the core loop is validated:

- Custom habit creation
- Difficulty-weighted matchmaking
- Creature / avatar evolution system
- Cosmetic unlocks
- Friend vs friend duels
- Ranked leagues (Bronze/Silver/Gold league pools)
- Revenge matches
- Guilds / team competitions
- Co-op boss battles
- Public leaderboards
- Seasonal tournaments
- In-app currency / betting system
- Health tracker integrations (Apple Health, Google Fit)
- AI-based photo verification

---

## 7. Primary Success Metric

> **Daily retention rate.** If users consistently return because they care about beating their opponent, the product works.

**Secondary metrics to track:**
- D7 retention (did the user come back on day 7?)
- Check-in completion rate (% of target habit days completed per user per week)
- Battle result screen open rate (did the user actually view the end-of-week reveal?)
- Notification click-through rate (especially opponent-activity notifications)
- Dispute rate (proxy for cheating prevalence)

---

## 8. Open Questions for Next Discussion

- **Scoring calibration** — do the base points and multiplier values feel right? Needs playtesting.
- **Reward layer** — rank progression is the MVP placeholder. What replaces it: creature evolution, cosmetics, or something else?
- **Target persona** — the 15–30 age range is broad. Narrowing to a primary persona will sharpen UX and marketing decisions.
- **Onboarding flow** — how does a new user understand the competition format before their first match?
