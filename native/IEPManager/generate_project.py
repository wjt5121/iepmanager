from pathlib import Path
import hashlib
root=Path(__file__).parent
objects={}
def ident(s): return hashlib.sha1(s.encode()).hexdigest()[:24].upper()
def obj(name,value): objects[ident(name)]=value; return ident(name)
def arr(xs): return '('+','.join(xs)+(',' if xs else '')+')'
products=[]; targets=[]; configs=[]
for name,folder,product,ptype in [('IEPManager','Sources','IEPManager.app','com.apple.product-type.application'),('IEPManagerTests','Tests','IEPManagerTests.xctest','com.apple.product-type.bundle.unit-test'),('IEPManagerUITests','UITests','IEPManagerUITests.xctest','com.apple.product-type.bundle.ui-testing')]:
 refs=[];builds=[]
 for file in sorted((root/folder).glob('*.swift')):
  ref=obj(str(file.relative_to(root)),f'{{isa=PBXFileReference;lastKnownFileType=sourcecode.swift;path="{file.name}";sourceTree="<group>";}}');refs.append(ref)
  builds.append(obj('build'+str(file),f'{{isa=PBXBuildFile;fileRef={ref};}}'))
 obj(folder,f'{{isa=PBXGroup;children={arr(refs)};path={folder};sourceTree="<group>";}}')
 prod=obj(product,f'{{isa=PBXFileReference;explicitFileType={"wrapper.application" if name=="IEPManager" else "wrapper.cfbundle"};path={product};sourceTree=BUILT_PRODUCTS_DIR;}}');products.append(prod)
 phase=obj(name+'Sources',f'{{isa=PBXSourcesBuildPhase;buildActionMask=2147483647;files={arr(builds)};runOnlyForDeploymentPostprocessing=0;}}')
 cs=[]
 for conf in ['Debug','Release']:
  settings={'PRODUCT_BUNDLE_IDENTIFIER':f'local.iepmanager.{name}','PRODUCT_NAME':'"$(TARGET_NAME)"','SWIFT_VERSION':'5.0','IPHONEOS_DEPLOYMENT_TARGET':'17.0','TARGETED_DEVICE_FAMILY':'"1,2"','GENERATE_INFOPLIST_FILE':'YES','CODE_SIGNING_ALLOWED':'YES','CODE_SIGN_IDENTITY':'"-"','ALWAYS_SEARCH_USER_PATHS':'NO','SDKROOT':'iphoneos','SWIFT_OPTIMIZATION_LEVEL':'"-Onone"' if conf=='Debug' else '"-O"','ENABLE_TESTABILITY':'YES','SWIFT_ACTIVE_COMPILATION_CONDITIONS':'DEBUG' if conf=='Debug' else '""'}
  if name=='IEPManager': settings.update({'INFOPLIST_KEY_NSCameraUsageDescription':'"Capture a worksheet for private on-device OCR."','INFOPLIST_KEY_UIApplicationSceneManifest_Generation':'YES','INFOPLIST_KEY_UILaunchScreen_Generation':'YES','INFOPLIST_KEY_UISupportedInterfaceOrientations':'"UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"','INFOPLIST_KEY_CFBundleDisplayName':'"IEP Manager"'})
  elif name=='IEPManagerTests': settings.update({'TEST_HOST':'"$(BUILT_PRODUCTS_DIR)/IEPManager.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/IEPManager"','BUNDLE_LOADER':'"$(TEST_HOST)"'})
  else: settings['TEST_TARGET_NAME']='IEPManager'
  cs.append(obj(name+conf,'{isa=XCBuildConfiguration;name='+conf+';buildSettings={'+''.join(k+'='+v+';' for k,v in settings.items())+'};}'))
 cl=obj(name+'configs',f'{{isa=XCConfigurationList;buildConfigurations={arr(cs)};defaultConfigurationName=Debug;defaultConfigurationIsVisible=0;}}')
 deps=[]
 if name!='IEPManager':
  proxy=obj(name+'proxy',f'{{isa=PBXContainerItemProxy;containerPortal={ident("project")};proxyType=1;remoteGlobalIDString={ident("IEPManagertarget")};remoteInfo=IEPManager;}}')
  deps=[obj(name+'dependency',f'{{isa=PBXTargetDependency;target={ident("IEPManagertarget")};targetProxy={proxy};}}')]
 targets.append(obj(name+'target',f'{{isa=PBXNativeTarget;name={name};productName={name};productType="{ptype}";productReference={prod};buildConfigurationList={cl};buildPhases={arr([phase])};dependencies={arr(deps) if deps else "()"};buildRules=();}}'))
obj('products',f'{{isa=PBXGroup;children={arr(products)};name=Products;sourceTree="<group>";}}')
main=obj('main',f'{{isa=PBXGroup;children={arr([ident("Sources"),ident("Tests"),ident("UITests"),ident("products")])};sourceTree="<group>";}}')
pcs=[obj('project'+c,f'{{isa=XCBuildConfiguration;name={c};buildSettings={{}};}}') for c in ['Debug','Release']]
pcl=obj('projectconfigs',f'{{isa=XCConfigurationList;buildConfigurations={arr(pcs)};defaultConfigurationName=Debug;defaultConfigurationIsVisible=0;}}')
obj('project',f'{{isa=PBXProject;attributes={{LastUpgradeCheck=2700;}};buildConfigurationList={pcl};compatibilityVersion="Xcode 14.0";developmentRegion=en;knownRegions=(en,Base);mainGroup={main};productRefGroup={ident("products")};projectDirPath="";projectRoot="";targets={arr(targets)};}}')
project=root/'IEPManager.xcodeproj';project.mkdir(exist_ok=True)
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n{archiveVersion=1;classes={};objectVersion=56;objects={\n'+''.join(k+'='+v+';\n' for k,v in objects.items())+'};rootObject='+ident('project')+';}')
scheme=project/'xcshareddata/xcschemes';scheme.mkdir(parents=True,exist_ok=True)
def ref(name): return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{ident(name+"target")}" BuildableName="{name+ (".app" if name=="IEPManager" else ".xctest")}" BlueprintName="{name}" ReferencedContainer="container:IEPManager.xcodeproj"/>'
(scheme/'IEPManager.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?><Scheme LastUpgradeVersion="2700" version="1.3"><BuildAction parallelizeBuildables="NO" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{ref('IEPManager')}</BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{ref('IEPManagerTests')}</TestableReference><TestableReference skipped="NO">{ref('IEPManagerUITests')}</TestableReference></Testables></TestAction><LaunchAction buildConfiguration="Debug" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref('IEPManager')}</BuildableProductRunnable></LaunchAction></Scheme>''')
