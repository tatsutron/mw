const VERSION = "0.0.1";

////////////////////////////////////////////////////////////////////////////////
const { exec } = require("child_process");
const drivelist = require("drivelist");
const fs = require("fs");
const https = require("https");
const wget = require("node-wget-promise");
const path = require("path");
const reader = require("readline-sync");
const rimraf = require("rimraf");
const { unrar } = require("unrar-promise");
const { v4: uuidv4 } = require("uuid");

////////////////////////////////////////////////////////////////////////////////
const log = require("./log");

////////////////////////////////////////////////////////////////////////////////
async function getDeviceList() {
    const list = await drivelist.list();
    log.debug({ driveList: list });
    return list.map((drive) => ({
        description: drive.description,
        device: drive.device,
        size: drive.size,
    }));
}

////////////////////////////////////////////////////////////////////////////////
function findFileUrlByName({ repo, startsWith }) {
    return new Promise((resolve, reject) => {
        const user = "MiSTer-devel";
        const options = {
            headers: {
                "User-Agent": uuidv4(),
            },
            host: "api.github.com",
            path: `/repos/${user}/${repo}/git/trees/master?recursive=1`,
        };
        const request = https.get(options, (response) => {
            const chunks = [];
            response.setEncoding("utf8");
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("error", (error) => reject(error));
            response.on("end", () => {
                const json = chunks.join("");
                const obj = JSON.parse(json);
                const releases = obj.tree
                    .map((elem) => elem.path)
                    .filter((entry) => entry.startsWith(startsWith))
                    .sort();
                const latest = releases[releases.length - 1];
                const url = `https://github.com/${user}/${repo}/raw/master/${latest}`;
                resolve(url);
            });
        });
        request.end();
    });
}

////////////////////////////////////////////////////////////////////////////////
function execShellCommand({ command, description }) {
    return new Promise((resolve, reject) => {
        log.info(description);
        log.debug({ command });
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout ? stdout : stderr);
        });
    });
}

////////////////////////////////////////////////////////////////////////////////
async function getDevice() {
    const deviceList = await getDeviceList();
    let device = null;
    while (true) {
        deviceList.forEach((device, index) => {
            log.info(
                `${log.magenta(index.toString())} -> ${device.description}`
            );
        });
        const choice = reader.question(
            `Please choose the target device by ${log.magenta("number")} `
        );
        const chosenDevice = deviceList[choice];
        if (chosenDevice) {
            const confirmation = reader.question(
                `All data on ${log.magenta(
                    chosenDevice.description
                )} will be lost, proceed? (y/n) `
            );
            if (confirmation === "y" || confirmation === "Y") {
                device = deviceList[choice].device;
                break;
            }
        }
    }
    return device;
}

////////////////////////////////////////////////////////////////////////////////
async function getFiles({ tempDir }) {
    let files = {};
    const installerUrl = await findFileUrlByName({
        repo: "SD-Installer-Win64_MiSTer",
        startsWith: "release",
    });
    log.debug({ installerUrl });
    const installerFilename = path.basename(installerUrl);
    files.installerArchive = path.join(tempDir, installerFilename);
    await wget(installerUrl, {
        onStart: () => log.info(`Downloading ${installerFilename}...`),
        onProgress: null,
        output: files.installerArchive,
    });
    files.installerFiles = path.join(tempDir, "installer");
    log.info(`Extracting ${installerFilename}...`);
    await unrar(files.installerArchive, files.installerFiles);
    const executableUrl = await findFileUrlByName({
        repo: "Main_MiSTer",
        startsWith: "releases/MiSTer",
    });
    log.debug({ executableUrl });
    const executableFilename = path.basename(executableUrl);
    files.executable = path.join(tempDir, executableFilename);
    await wget(executableUrl, {
        onStart: () => log.info(`Downloading ${executableFilename}...`),
        onProgress: null,
        output: files.executable,
    });
    const menuCoreUrl = await findFileUrlByName({
        repo: "Menu_MiSTer",
        startsWith: "releases/menu",
    });
    log.debug({ menuCoreUrl });
    const menuCoreFilename = path.basename(menuCoreUrl);
    files.menuCore = path.join(tempDir, menuCoreFilename);
    await wget(menuCoreUrl, {
        onStart: () => log.info(`Downloading ${menuCoreFilename}...`),
        onProgress: null,
        output: files.menuCore,
    });
    return files;
}

////////////////////////////////////////////////////////////////////////////////
function createTempDir() {
    const tempDir = "./mw_temp";
    if (fs.existsSync(tempDir)) {
        log.debug(`Removing ${path.join(__dirname, tempDir)}...`);
        rimraf.sync(tempDir);
    }
    log.debug(`Creating ${path.join(__dirname, tempDir)}...`);
    fs.mkdirSync(tempDir);
    return tempDir;
}

////////////////////////////////////////////////////////////////////////////////
(async () => {
    log.out("\n");
    log.out(log.underscore(`MiSTer Wizard v${VERSION} by tatsutron`));
    log.out("\n\n");

    const device = await getDevice();
    log.debug({ device });

    const tempDir = createTempDir();
    const files = await getFiles({ tempDir });
    log.debug({ files });

    const volumeName = "MiSTer_Data";
    const filesPath = path.join(tempDir, "installer/files/*");
    const imagePath = path.join(files.installerFiles, "files/linux/uboot.img");
    log.debug({ volumeName, filesPath, imagePath });

    await execShellCommand({
        command: `diskutil partitionDisk ${device} MBR ExFAT ${volumeName} R ExFAT UBOOT 3M`,
        description: "Partitioning SD card...",
    });
    await execShellCommand({
        command: `cp -Rv ${filesPath} /Volumes/${volumeName}/`,
        description: "Copying MiSTer files...",
    });
    await execShellCommand({
        command: `cp ${files.executable} /Volumes/${volumeName}/MiSTer`,
        description: "Copying executable...",
    });
    await execShellCommand({
        command: `cp ${files.menuCore} /Volumes/${volumeName}/menu.rbf`,
        description: "Copying menu core...",
    });
    await execShellCommand({
        command: `diskutil unmountDisk ${device}`,
        description: "Unmounting SD card...",
    });
    await execShellCommand({
        command: `sudo fdisk -d ${device} | sed 'n;s/0x07/0xA2/g' | sudo fdisk -ry ${device}`,
        description: "Fixing the SD card partition table to support UBOOT...",
    });
    await execShellCommand({
        command: `sudo dd if=${imagePath} of=${device}s2 bs=64k`,
        description: "Writing uboot image to the UBOOT partition...",
    });
    await execShellCommand({
        command: `sudo mdutil -d /Volumes/${volumeName}`,
        description: "Disabling Spotlight indexing...",
    });
    await execShellCommand({
        command: `rm -rf /Volumes/${volumeName}.Spotlight-V100`,
        description: "Removing Spotlight files...",
    });
    await execShellCommand({
        command: `rm -rf /Volumes/${volumeName}.fseventsd`,
        description: "Removing (more) Spotlight files...",
    });
    await execShellCommand({
        command: `diskutil eject ${device}`,
        description: "Ejecting SD card...",
    });

    log.debug(`Removing ${path.join(__dirname, tempDir)}`);
    rimraf.sync(tempDir);

    log.info("Done!");
})();
