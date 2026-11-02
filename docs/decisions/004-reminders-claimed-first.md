# 004: Reminders are claimed before they are sent

**Date:** 2 November 2026

Each reminder (kind, item, step) is inserted into `ReminderSent` with a unique key before the email is queued. If the insert finds the row already there, nothing is sent. This makes "at most once per item and step" hold even if the daily job runs twice, and lets a late run send only the latest step instead of a burst of old ones. Reminders stop naturally: a paid charge, a renewed certificate (a newer one becomes current), a protected deposit or a new Right to Rent check means there is nothing left to claim.
