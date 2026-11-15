import Foundation
import CryptoKit
import Security
import CommonCrypto

protocol VaultKeys { func key(create: Bool) throws -> SymmetricKey }
struct DeviceKey: VaultKeys {
    let account: String
    func key(create: Bool) throws -> SymmetricKey {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "local.iepmanager.vault", kSecAttrAccount as String: account, kSecAttrSynchronizable as String: false]
        var result: CFTypeRef?
        var read = query; read[kSecReturnData as String] = true
        let status = SecItemCopyMatching(read as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data, data.count == 32 { return SymmetricKey(data: data) }
        guard status == errSecItemNotFound, create else { throw NativeError.locked }
        let key = SymmetricKey(size: .bits256)
        var add = query
        add[kSecValueData as String] = key.withUnsafeBytes { Data($0) }
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else { throw NativeError.locked }
        return key
    }
}
struct BackupEnvelope: Codable {
    var version: Int
    var rounds: Int
    var salt: Data
    var ciphertext: Data
}
struct Vault {
    let url: URL
    let keys: any VaultKeys
    var identity = "primary-workspace"
    var write: (Data, URL) throws -> Void = { try $0.write(to: $1, options: [.atomic, .completeFileProtection]) }
    var context: Data { Self.context + Data(identity.utf8) }
    static let context = Data("IEPManager.vault.v1".utf8)
    func load() throws -> NativeWorkspace {
        let exists = FileManager.default.fileExists(atPath: url.path)
        let key = try keys.key(create: !exists)
        if !exists { return NativeWorkspace() }
        do { return try decode(AES.GCM.open(AES.GCM.SealedBox(combined: Data(contentsOf: url)), using: key, authenticating: context)) }
        catch { throw NativeError.locked }
    }
    func save(_ workspace: NativeWorkspace) throws {
        let key = try keys.key(create: !FileManager.default.fileExists(atPath: url.path))
        let plaintext = try JSONEncoder().encode(workspace.validated())
        let encrypted = try AES.GCM.seal(plaintext, using: key, authenticating: context).combined!
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        var directory = url.deletingLastPathComponent()
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        try write(encrypted, url)
    }
    func backup(_ workspace: NativeWorkspace, password: String) throws -> Data {
        guard password.count >= 12 else { throw NativeError.password }
        var salt = Data(count: 32)
        let result = salt.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!) }
        guard result == errSecSuccess else { throw NativeError.locked }
        let rounds = 600_000
        let key = try Self.derive(password, salt: salt, rounds: rounds)
        let aad = Self.backupContext(salt)
        let encrypted = try AES.GCM.seal(JSONEncoder().encode(workspace.validated()), using: key, authenticating: aad).combined!
        return try JSONEncoder().encode(BackupEnvelope(version: 1, rounds: rounds, salt: salt, ciphertext: encrypted))
    }
    func restore(_ data: Data, password: String) throws -> NativeWorkspace {
        guard password.count >= 12 else { throw NativeError.password }
        guard data.count <= 100_000_000 else { throw NativeError.tooLarge }
        let envelope = try JSONDecoder().decode(BackupEnvelope.self, from: data)
        guard envelope.version == 1, envelope.rounds == 600_000, envelope.salt.count == 32 else { throw NativeError.invalidRecord }
        let key = try Self.derive(password, salt: envelope.salt, rounds: envelope.rounds)
        let workspace = try decode(AES.GCM.open(AES.GCM.SealedBox(combined: envelope.ciphertext), using: key, authenticating: Self.backupContext(envelope.salt)))
        try save(workspace) // Publish only after authentication, decoding and validation all succeed.
        return workspace
    }
    private func decode(_ data: Data) throws -> NativeWorkspace { try JSONDecoder().decode(NativeWorkspace.self, from: data).validated() }
    static func backupContext(_ salt: Data) -> Data { Data("IEPManager.backup.v1.PBKDF2-SHA256.600000".utf8) + salt }
    static func derive(_ password: String, salt: Data, rounds: Int) throws -> SymmetricKey {
        var output = Data(count: 32)
        let bytes = Array(password.utf8)
        let result = output.withUnsafeMutableBytes { dest in
            salt.withUnsafeBytes { source in
                bytes.withUnsafeBytes { pass in
                    CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), pass.baseAddress!.assumingMemoryBound(to: Int8.self), bytes.count, source.baseAddress!.assumingMemoryBound(to: UInt8.self), salt.count, CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), UInt32(rounds), dest.baseAddress!.assumingMemoryBound(to: UInt8.self), 32)
                }
            }
        }
        guard result == kCCSuccess else { throw NativeError.locked }
        return SymmetricKey(data: output)
    }
}
