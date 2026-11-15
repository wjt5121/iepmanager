import XCTest
final class JourneyTests: XCTestCase {
    func testNativeOCRReviewPersistenceCameraAndFailedSave() throws {
        let app=XCUIApplication();let fixture=["-test-vault",UUID().uuidString];app.launchArguments=fixture;app.resetAuthorizationStatus(for: .camera);app.launch()
        XCTAssertTrue(app.tabBars.buttons["Sources"].waitForExistence(timeout:15))
        app.tabBars.buttons["Sources"].tap()
        app.buttons["camera"].tap()
        let permission=XCUIApplication(bundleIdentifier:"com.apple.springboard").alerts.firstMatch
        if permission.waitForExistence(timeout:5) {
            let deny=permission.buttons.matching(NSPredicate(format:"label CONTAINS %@ AND label != %@", "Allow", "Allow")).firstMatch
            XCTAssertTrue(deny.exists);deny.tap()
        }
        let denied=NSPredicate(format:"label CONTAINS %@ OR label CONTAINS %@", "permission denied", "Camera unavailable")
        expectation(for:denied,evaluatedWith:app.staticTexts["status"])
        waitForExpectations(timeout:10)
        app.buttons["synthetic"].tap()
        let source=app.buttons.matching(NSPredicate(format:"label CONTAINS %@","synthetic-worksheet.png")).firstMatch
        XCTAssertTrue(source.waitForExistence(timeout:30));source.tap()
        XCTAssertTrue(app.staticTexts["Review OCR; confidence is not correctness"].exists || app.navigationBars["Review source"].exists)
        let goalCell=app.cells.containing(.staticText, identifier:"Goal: Read words with 80% accuracy in 4 of 5 trials.").firstMatch
        for _ in 0..<6 { if goalCell.isHittable { break }; app.swipeUp() }
        let draft=goalCell.buttons["Use this source line as draft"].firstMatch
        XCTAssertTrue(draft.waitForExistence(timeout:10));draft.tap()
        app.tabBars.buttons["Workspace"].tap()
        XCTAssertTrue(app.staticTexts["Draft — review required"].firstMatch.waitForExistence(timeout:10))
        app.terminate();app.launch()
        XCTAssertTrue(app.staticTexts["Draft — review required"].firstMatch.waitForExistence(timeout:15))
        app.cells.containing(.staticText,identifier:"Draft — review required").firstMatch.tap()
        let approve=app.buttons["approveGoal"]
        app.swipeUp(velocity: .slow)
        let confirmation=app.switches["criteriaConfirmed"]
        for _ in 0..<5 { if confirmation.isHittable { break }; app.swipeDown() }
        XCTAssertTrue(confirmation.exists)
        confirmation.coordinate(withNormalizedOffset: CGVector(dx:0.9,dy:0.5)).tap()
        XCTAssertEqual(confirmation.value as? String, "1")
        XCTAssertTrue(approve.isEnabled)
        approve.tap()
        let evidence=app.textFields["evidenceID"]
        for _ in 0..<5 { if evidence.isHittable { break }; app.swipeUp() }
        evidence.tap();evidence.typeText("synthetic-trial-1\n")
        app.swipeUp()
        app.buttons["saveObservation"].tap()
        for _ in 0..<5 { if app.staticTexts["mastery"].exists { break }; app.swipeDown() }
        XCTAssertTrue(app.staticTexts["mastery"].label.contains("Insufficient evidence: 1/5"))
        app.navigationBars.buttons.firstMatch.tap()
        for _ in 0..<5 { if app.buttons["Prepare reviewed report"].isHittable { break }; app.swipeUp() }
        app.buttons["Prepare reviewed report"].tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@", "Observation: 8/10")).firstMatch.exists)
        app.tabBars.buttons["Recovery"].tap()
        let password=app.secureTextFields.firstMatch
        password.tap();password.typeText("synthetic-recovery-secret\n")
        for _ in 0..<5 { if app.buttons["localBackup"].isHittable { break }; app.swipeUp() }
        app.buttons["localBackup"].tap()
        XCTAssertTrue(app.staticTexts["status"].label.contains("recovery copy saved"))
        for _ in 0..<5 { if app.buttons["restoreLocal"].isHittable { break }; app.swipeUp() }
        app.buttons["restoreLocal"].tap()
        app.buttons["Restore local backup"].tap()
        XCTAssertTrue(app.staticTexts["status"].label.contains("backup restored"))
        app.terminate();app.launchArguments=fixture+["-inject-save-failure"];app.launch()
        let name=app.textFields["studentName"];name.tap();name.typeText("-UNSAVED")
        app.buttons["Save student"].tap()
        XCTAssertTrue(app.staticTexts["status"].label.contains("Save failed"))
        app.terminate();app.launchArguments=fixture;app.launch()
        XCTAssertTrue(app.staticTexts["Human approved"].firstMatch.waitForExistence(timeout:15))
        XCTAssertFalse((app.textFields["studentName"].value as? String ?? "").contains("UNSAVED"))
        let shot=XCTAttachment(screenshot:app.screenshot());shot.name="Native workspace after restart";shot.lifetime = .keepAlways;add(shot)
    }
}
