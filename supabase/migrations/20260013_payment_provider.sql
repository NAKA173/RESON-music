-- PaymentProvider抽象化レイヤー導入に伴うDB拡張（v3.4第3章）
-- payment_id は既存のプロバイダ固有決済ID（provider_charge_id相当）としてそのまま使用し、
-- どのプロバイダで処理されたかを payment_provider に記録する。

alter table supports
  add column if not exists payment_provider text not null default 'stripe';

alter table boost_hearts
  add column if not exists payment_provider text not null default 'stripe';
