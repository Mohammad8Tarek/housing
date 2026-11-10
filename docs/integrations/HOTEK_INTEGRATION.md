# Sunrise Housing - Hotek PMS Bridge Integration

This document outlines how the Sunrise Housing backend integrates with the **Hotek Door Locks System** via the **Fidelio (FIAS)** protocol.

## Overview

Unlike standard standalone encoders (IP/USB) where the software acts as a client connecting to an encoder, the Hotek system requires our backend to act as a **PMS Server (Bridge)**.

Hotek's `PMSServer` software connects to our backend. We speak the standard FIAS (Fidelio Interface Application Specification) protocol to instruct Hotek to encode keys.

- **Our Role**: TCP Server (Listener)
- **Hotek's Role**: TCP Client
- **Port**: `10003` (Configurable via code)
- **Protocol**: FIAS over TCP/IP

## Configuration in Hotek PMSServer

To ensure successful communication, the Hotek PMSServer must be configured as follows:

1. **Interface Type**: `Fidelio`
   _(Do NOT select TCP/IP or File interfaces, as they use proprietary formats instead of standard FIAS)_
2. **PMS IP Address**: The IP address of the machine running the Sunrise Housing backend (e.g. `127.0.0.1` if running locally, or the local network IP like `192.168.1.100`).
3. **Port**: `10003`

## Communication Flow

### 1. Connection & Keep-Alive

1. `api-server` starts and listens on TCP port `10003`.
2. Hotek PMSServer connects to `10003`.
3. Hotek sends a Link Start request: `LS|DA...|TI...|`.
4. Our PMS Bridge replies with Link Alive: `LA|DA...|TI...|` to acknowledge the connection.
5. The connection is kept open continuously.

### 2. Issuing a Key (Single)

When a user clicks "Issue" for a new card:

1. The frontend calls `/api/keys/issue` with `isDuplicate = false`.
2. The PMS Bridge constructs a FIAS Key Request (`KR`):

   ```
   KR|WS1|KC1|RN202|KTN|G#1|GA260704|GD260711|DT120000|GNMohamed Tarek|
   ```

   - `WS1` / `KC1`: Workstation 1, Key Coder 1.
   - `KTN`: **Key Type New** (Invalidates previously issued keys for this room).

3. Hotek receives the `KR` and prompts the encoder to write the card.
4. Hotek replies with Key Answer (`KA`):
   ```
   KA|WS1|KC1|ASOK|
   ```
5. If `ASOK` is received, the backend returns success. If `ASBY` is received, the encoder is busy or not found.

### 3. Cloning / Duplicating Keys

If the user requests multiple cards (e.g. Key Count = 3):

1. **Card 1**: Backend sends `KTN` (Key Type New) to establish the rolling code.
2. **Card 2**: Backend sends `KTD` (Key Type Duplicate). This ensures Card 2 works _alongside_ Card 1.
3. **Card 3**: Backend sends `KTD`.

The frontend loops and sequentially prompts the user to place the next card upon each successful response.

## Troubleshooting

- **"Connection timeout" / "No response from Hotek"**: Hotek PMSServer is not connected, or the FIAS `LS`/`LA` handshake failed. Ensure Hotek is set to `Fidelio` and port `10003`.
- **`ASBY` (Check-In fail)**: Hotek is connected, but the physical encoder device is not responding or is configured to a different ID. Ensure the Hotek Workstation/Encoder ID matches `WS1` / `KC1`.
