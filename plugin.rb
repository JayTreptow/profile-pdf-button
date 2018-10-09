# name: profile-pdf-button
# about: Adds a custom button at the bottom of a topic to create a profile PDF
# version: 0.1
# authors: Jay Treptow
# url: https://github.com/JayTreptow/profile-pdf-button

enabled_site_setting :profile_pdf_button_enabled

after_initialize do
  add_to_serializer(:current_user, :can_see_profile_pdf_button?) do
    return true if scope.is_staff?
    group = Group.find_by("lower(name) = ?", SiteSetting.profile_pdf_button_allowed_group.downcase)
    return true if group && GroupUser.where(user_id: scope.user.id, group_id: group.id).exists?
  end
end
