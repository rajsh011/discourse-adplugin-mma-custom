import AdComponent from "discourse/plugins/discourse-adplugin/discourse/components/ad-component";
import discourseComputed, { on } from "discourse-common/utils/decorators";
import loadScript from "discourse/lib/load-script";


export default AdComponent.extend({

    @discourseComputed()
  divId() {
      return "rectangle_1";
  },
  @discourseComputed(
    "siteSettings.dfp_publisher_id",
    "siteSettings.dfp_publisher_id_mobile",
    "site.mobileView"
  )
  publisherId(globalId, mobileId, isMobile) {
    if (isMobile) {
      return mobileId || globalId;
    } else {
      return globalId;
    }
  },
  @discourseComputed("currentUser.trust_level")
  showToTrustLevel(trustLevel) {
    return !(
      trustLevel && trustLevel > this.siteSettings.dfp_through_trust_level
    );
  },
  @discourseComputed(
    "publisherId", 
    "showToTrustLevel", 
    "showToGroups",
    "showOnCurrentPage",
  )
  showAd(
    publisherId,
    showToTrustLevel,
    showToGroups,
    showOnCurrentPage
    ) {
      //dont show if disabled from settings
      if(!this.siteSettings.dfp_show_topic_navigation_ad){
        return false;
      }
        //dont show in admin area
      if (window.location.href.indexOf("admin") > -1) {
            return false;
            }
    return (
      publisherId &&
      showToTrustLevel &&
      showToGroups &&
      showOnCurrentPage
    );
  }
})