  .syntax unified
  .cpu cortex-m4
  .thumb
  .global asm_main
  .type asm_main, %function

// STM32F407 GPIO: base GPIOA 0x40020000, GPIOB 0x40020400, GPIOC 0x40020800
// IDR offset 0x10, ODR offset 0x14
.equ	GPIOC_ODR,	0x40020814	// For 7-seg on pins 0 to 7
.equ	GPIOA_ODR,	0x40020014	// For LED on pin 5
.equ	GPIOA_IDR,	0x40020010	// For custom buttons on pins 8-11
.equ	GPIOB_IDR,	0x40020410	// For button on pin 13
.equ	DELAY_COUNT,	5333333		// ~1 s at 16 MHz HSI (3 cycles/iteration)

// Hardware configuration summary:
// 	Nucleo LED on PA5
// 	Nucleo button on PB13
// 	4x tactile switches on PA8 to PA11
// 	7-segment on PC0 to PC7

// GPIO setup is done in main.c before asm_main is called

asm_main:

ldr r2, =0 // counter from 0 -> 8
ldr r3, =8 // end value
ldr r4, =GPIOC_ODR

loop:

ldr r5, =0 // status reg for whether or not to skip a digit

ldr r0, =ssegdata    // r0 = address of segment LUT
ldr r1, =iseven      // r1 = address of even/odd LUT
ldrb r0, [r0, r2]    // r0 = segment pattern for digit r2
ldrb r1, [r1, r2]    // r1 = 1 if digit r2 is even

add r5, r1           // if the LUT says 1, the number COULD be skipped


//add r5, #0           // simulate button press, needs to be a UBFX
ldr r6, =GPIOA_IDR
ldr r6, [r6]
ubfx r6, r6, #8, #1  // read PA8 into r6
add r5, r6

cmp r5, #2           // two conditions must be met to skip
beq increment        // odd: skip display and delay

str r0, [r4]         // even: output to hardware
nop                  // put a breakpoint here
bl delay_1s

increment:
add r2, r2, #1       // increment counter
cmp r2, r3
beq end

b     loop           // repeat forever (skip setup)

end:
b asm_main

delay_1s:
    ldr  r7, =DELAY_COUNT
1:  subs r7, r7, #1
    bne  1b
    bx   lr              // return to caller (address saved in lr by bl)
            
.align 4
ssegdata:   // The LUT
    .byte 0x39  // C
    .byte 0x4F  // 3
    .byte 0x6D  // 5
    .byte 0x06  // 1
    .byte 0x07  // 7
    .byte 0x06  // 1
    .byte 0x7D  // 6
    .byte 0x06  // 1

iseven:    // wake up babe new LUT just dropped
    .byte 0x00  // C
    .byte 0x01  // 3
    .byte 0x01  // 5
    .byte 0x01  // 1
    .byte 0x01  // 7
    .byte 0x01  // 1
    .byte 0x00  // 6
    .byte 0x01  // 1