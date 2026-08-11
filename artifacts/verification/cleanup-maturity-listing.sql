do $$
begin
  delete from public.campaigns campaign
  using auth.users account
  where account.id = campaign.owner_user_id
    and account.email in ('social-host@local.test', 'social-player-one@local.test')
    and campaign.name = 'Shit-Forged Mature Table';

  update public.account_entitlements entitlement
  set tier = 'FREE', updated_at = now()
  from auth.users account
  where account.id = entitlement.user_id
    and account.email in ('social-host@local.test', 'social-player-one@local.test');

  update public.social_profiles social
  set content_preference = 'STANDARD', version = version + 1, updated_at = now()
  from auth.users account
  where account.id = social.user_id
    and account.email = 'social-host@local.test';
end
$$;
