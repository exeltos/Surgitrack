revoke execute on function public.accept_surgitrack_invitation() from public,anon,authenticated;
revoke execute on function public.assign_user_code() from public,anon,authenticated;
revoke execute on function public.generate_user_code(text) from public,anon,authenticated;
revoke execute on function public.handle_new_user() from public,anon,authenticated;
revoke execute on function public.link_registration_auth_user() from public,anon,authenticated;
revoke execute on function public.list_registration_requests() from public,anon,authenticated;
revoke execute on function public.submit_registration_request(text,text,text,text) from public,anon,authenticated;
revoke execute on function public.platform_create_department(uuid,text,text) from public,anon;
revoke execute on function public.platform_create_organization(text,text) from public,anon;
revoke execute on function public.platform_list_departments() from public,anon;
revoke execute on function public.platform_set_profile_access(uuid,boolean,boolean) from public,anon;
revoke execute on function public.platform_update_department(uuid,text,text,boolean) from public,anon;
revoke execute on function public.platform_update_organization(uuid,text,text,boolean,boolean) from public,anon;
revoke execute on function public.claim_platform_admin() from public,anon;
-- obsolete public registration path
revoke execute on function public.submit_registration_request(text,text,text,text) from authenticated;
