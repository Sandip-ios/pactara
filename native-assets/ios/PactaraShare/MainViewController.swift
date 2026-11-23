import Capacitor
import UIKit

/// Registers app-local plugins. Set this as the custom class of the Bridge
/// View Controller in Main.storyboard (Identity inspector → Class).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PactaraSharePlugin())
    }
}
