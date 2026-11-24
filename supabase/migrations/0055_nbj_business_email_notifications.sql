-- 0055: Track NBJ Business email notification delivery
alter table public.business_enquiries
  add column if not exists email_notification_status text not null default 'pending'
    check (email_notification_status in ('pending','sent','skipped','failed')),
  add column if not exists email_notification_sent_at timestamptz;

comment on column public.business_enquiries.email_notification_status is
  'Delivery status for the business-owner email alert; the enquiry itself remains stored regardless of email delivery.';
