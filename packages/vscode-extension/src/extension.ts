import * as vscode from 'vscode';
import { ShipLensController } from './controller.js';

let controller: ShipLensController | undefined;
let logger: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  logger = vscode.window.createOutputChannel('ShipLens');
  context.subscriptions.push(logger);

  controller = new ShipLensController(logger);
  context.subscriptions.push(controller);

  logger.appendLine('[shiplens] activated (v0.1).');
}

export function deactivate(): void {
  controller?.dispose();
  controller = undefined;
  logger = undefined;
}
