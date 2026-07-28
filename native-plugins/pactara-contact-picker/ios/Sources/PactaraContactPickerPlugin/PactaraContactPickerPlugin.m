#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Legacy Objective-C bridge registration. This complements the Swift
// CAPBridgedPlugin conformance and guarantees the plugin is discovered by
// Capacitor's Objective-C runtime lookup during `cap sync ios` and at app
// launch. Without this macro, some Capacitor 6/7/8 build configurations
// silently fail to register Swift-only plugins.
CAP_PLUGIN(PactaraContactPickerPlugin, "PactaraContactPicker",
    CAP_PLUGIN_METHOD(pickContact, CAPPluginReturnPromise);
)
