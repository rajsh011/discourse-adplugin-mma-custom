import AdComponent from "discourse/plugins/discourse-adplugin/discourse/components/ad-component";
import discourseComputed, { on } from "discourse-common/utils/decorators";
import loadScript from "discourse/lib/load-script";
import { alias } from "@ember/object/computed";
import RSVP from "rsvp";
import { isTesting } from "discourse-common/config/environment";
import { htmlSafe } from "@ember/template";

let _didnaLoaded = false,
  _didnaPromise = null,
  ads = {},
  nextSlotNum = 1,
  renderCounts = {};

function getNextSlotNum() {
  return nextSlotNum++;
}

function splitWidthInt(value) {
  let str = value.substring(0, 3);
  return str.trim();
}

function splitHeightInt(value) {
  let str = value.substring(4, 7);
  return str.trim();
}

// This creates an array for the values of the custom targeting key
function valueParse(value) {
  let final = value.replace(/ /g, "");
  final = final.replace(/['"]+/g, "");
  final = final.split(",");
  return final;
}

// This creates an array for the key of the custom targeting key
function keyParse(word) {
  let key = word;
  key = key.replace(/['"]+/g, "");
  key = key.split("\n");
  return key;
}

const DESKTOP_SETTINGS = {
  "topic-list-top": {
    code: "dfp_topic_list_top_code",
    sizes: "dfp_topic_list_top_ad_sizes",
    targeting_keys: "dfp_target_topic_list_top_key_code",
    targeting_values: "dfp_target_topic_list_top_value_code",
  },
  "topic-above-post-stream": {
    code: "dfp_topic_above_post_stream_code",
    sizes: "dfp_topic_above_post_stream_ad_sizes",
    targeting_keys: "dfp_target_topic_above_post_stream_key_code",
    targeting_values: "dfp_target_topic_above_post_stream_value_code",
  },
  "topic-above-suggested": {
    code: "dfp_topic_above_suggested_code",
    sizes: "dfp_topic_above_suggested_ad_sizes",
    targeting_keys: "dfp_target_topic_above_suggested_key_code",
    targeting_values: "dfp_target_topic_above_suggested_value_code",
  },
  "post-bottom": {
    code: "dfp_post_bottom_code",
    sizes: "dfp_side_ad_sizes",
    targeting_keys: "dfp_target_post_bottom_key_code",
    targeting_values: "dfp_target_post_bottom_value_code",
  },
  "side-ad":{
    code: "dfp_side_ad_code",
    sizes: "dfp_mobile_side_ad_sizes",
    targeting_keys: "dfp_target_side_ad_key_code",
    targeting_values: "dfp_target_side_ad_value_code",
  },
};

const MOBILE_SETTINGS = {
  "topic-list-top": {
    code: "dfp_mobile_topic_list_top_code",
    sizes: "dfp_mobile_topic_list_top_ad_sizes",
    targeting_keys: "dfp_target_topic_list_top_key_code",
    targeting_values: "dfp_target_topic_list_top_value_code",
  },
  "topic-above-post-stream": {
    code: "dfp_mobile_topic_above_post_stream_code",
    sizes: "dfp_mobile_topic_above_post_stream_ad_sizes",
    targeting_keys: "dfp_target_topic_above_post_stream_key_code",
    targeting_values: "dfp_target_topic_above_post_stream_value_code",
  },
  "topic-above-suggested": {
    code: "dfp_mobile_topic_above_suggested_code",
    sizes: "dfp_mobile_topic_above_suggested_ad_sizes",
    targeting_keys: "dfp_target_topic_above_suggested_key_code",
    targeting_values: "dfp_target_topic_above_suggested_value_code",
  },
  "post-bottom": {
    code: "dfp_mobile_post_bottom_code",
    sizes: "dfp_mobile_post_bottom_ad_sizes",
    targeting_keys: "dfp_target_post_bottom_key_code",
    targeting_values: "dfp_target_post_bottom_value_code",
  },
  "side-ad":{
    code: "dfp_mobile_side_ad_code",
    sizes: "dfp_mobile_side_ad_sizes",
    targeting_keys: "dfp_target_side_ad_key_code",
    targeting_values: "dfp_target_side_ad_value_code",
  },
};

function getWidthAndHeight(placement, settings, isMobile) {
  let config, size;

  if (isMobile) {
    config = MOBILE_SETTINGS[placement];
  } else {
    config = DESKTOP_SETTINGS[placement];
  }

  if (!renderCounts[placement]) {
    renderCounts[placement] = 0;
  }

  const sizes = (settings[config.sizes] || "").split("|");

  if (sizes.length === 1) {
    size = sizes[0];
  } else {
    size = sizes[renderCounts[placement] % sizes.length];
    renderCounts[placement] += 1;
  }

  if (size === "fluid") {
    return { width: "fluid", height: "fluid" };
  }

  const sizeObj = {
    width: parseInt(splitWidthInt(size), 10),
    height: parseInt(splitHeightInt(size), 10),
  };

  if (!isNaN(sizeObj.width) && !isNaN(sizeObj.height)) {
    return sizeObj;
  }
}

function defineSlot(
  placement,
  settings,
  isMobile
) {

  let ad, config;

  if (isMobile) {
    config = MOBILE_SETTINGS[placement];
  } else {
    config = DESKTOP_SETTINGS[placement];
  }
  return "/" + settings[config.code];
}

function destroySlot( divId ) {
  var didna = window.didna || {};
  didna.cmd = didna.cmd || [];
  didna.cmd.push(function () {
      didna.removeAdUnits(divId);
  });
}

function loadDiDNA() {
  /**
   * Refer to this article for help:
   * https://support.google.com/admanager/answer/4578089?hl=en
   */

  if (_didnaLoaded) {
    return RSVP.resolve();
  }

  if (_didnaPromise) {
    return _didnaPromise;
  }

  // The boilerplate code
  let dfpSrc =
    ("https:" === document.location.protocol ? "https:" : "http:") +
    "//storage.googleapis.com/didna_hb/spg/sportspublishersgroupmixedmartialarts/didna_config.js";
    _didnaPromise = loadScript(dfpSrc, { scriptTag: true }).then(function () {
    _didnaLoaded = true;
  });

  return _didnaPromise;
}

export default AdComponent.extend({
  classNameBindings: ["adUnitClass"],
  classNames: ["google-dfp-ad"],
  refreshOnChange: null,
  lastAdRefresh: null,
  width: alias("size.width"),
  height: alias("size.height"),

  @discourseComputed
  size() {
    return getWidthAndHeight(
      this.get("placement"),
      this.siteSettings,
      this.site.mobileView
    );
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

  @discourseComputed("placement", "postNumber")
  divId(placement, postNumber) {
    //#yg- id for side ads
    /* if(postNumber == 0){
      return `skyscraper_1`;
    } */
    let slotNum = getNextSlotNum();
      return `didna_slot_${slotNum}`;
  },

  @discourseComputed("placement", "showAd")
  adUnitClass(placement, showAd) {
    return showAd ? `dfp-ad-${placement}` : "";
  },

  @discourseComputed("width", "height")
  adWrapperStyle(w, h) {
    if (w !== "fluid") {
      return htmlSafe(`width: ${w}px; height: ${h}px;`);
    }
  },

  @discourseComputed("width")
  adTitleStyleMobile(w) {
    if (w !== "fluid") {
      return htmlSafe(`width: ${w}px;`);
    }
  },

  @discourseComputed(
    "publisherId",
    "showToTrustLevel",
    "showToGroups",
    "showAfterPost",
    "showOnCurrentPage",
    "size"
  )
  showAd(
    publisherId,
    showToTrustLevel,
    showToGroups,
    showAfterPost,
    showOnCurrentPage,
    size
  ) {
    return (
      publisherId &&
      showToTrustLevel &&
      showToGroups &&
      showAfterPost &&
      showOnCurrentPage &&
      size
    );
  },

  @discourseComputed("currentUser.trust_level")
  showToTrustLevel(trustLevel) {
    return !(
      trustLevel && trustLevel > this.siteSettings.dfp_through_trust_level
    );
  },

  @discourseComputed("postNumber")
  showAfterPost(postNumber) {
    if (!postNumber) {
      return true;
    }

    return this.isNthPost(parseInt(this.siteSettings.dfp_nth_post_code, 10));
  },

  @on("didInsertElement")
  _initGoogleDFP() {
    if (isTesting()) {
      return; // Don't load external JS during tests
    }

    if (!this.get("showAd")) {
      return;
    }
    var didna = window.didna || {};
    didna.cmd = didna.cmd || [];
    var didna_counter = window.didna_counter || 0;
    var id = this.get( "divId" );
    var adUnitPath = defineSlot(this.get("placement"), this.siteSettings, this.site.mobileView);

    didna.cmd.push(function () {
      didna.createAdUnits({
          id: id,
          adUnitPath: adUnitPath,
          size: [728, 90],
          sizeMap: [
              [
                  [728, 0],
                  [[728, 90],[468, 60],],
              ],
              [
                  [468, 0],[468, 60],
              ],
              [
                  [320, 0],
                  [[320, 50],[320, 100],],
              ],
          ],
      });
      didna_counter++;
  });

    loadDiDNA().then(() => {

    });
  },

  willRender() {
    this._super(...arguments);

    if (!this.get("showAd")) {
      return;
    }
  },

  @on( "willDestroyElement" )
	cleanup() {
		destroySlot( this.get( "divId" ) );
	},

});
