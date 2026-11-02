  .syntax unified
  .cpu cortex-m3
  .thumb
  .global asm_main
  .type asm_main, %function

.equ	GPIOC_ODR,	0x4001100C	// For 7-seg on pins 0 to 7
.equ	GPIOA_ODR,	0x4001080C	// For Nucleo LED on pin 5
.equ	GPIOA_IDR,	0x40010808	// For custom buttons on pins 8-11
.equ	GPIOB_ODR,	0x40010C0C	// For Nucleo button on pin 13
.equ	DELAY_COUNT,	2666667		// ~1 s at 8 MHz

// Hardware configuration summary:
// 	Nucleo LED on PA5
// 	Nucleo button on PB13
// 	4x tactile switches on PA8 to PA11
// 	7-segment on PC0 to PC7

// GPIO setup is done in main.c before asm_main is called

asm_main:

ldr r2, =0 // counter from 0 -> 8
ldr r3, =8 // end value
ldr r1, =GPIOC_ODR

loop:

ldr r0, =ssegdata    // r0 = address of LUT
ldrb r0, [r0, r2]    // r0 = first byte of LUT (0x39 = 'C')

str r0, [r1]         // output to hardware

bl delay_1s

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