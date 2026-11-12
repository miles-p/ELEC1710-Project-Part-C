// 456 bytes (includes some C bloat)
  .syntax unified
  .cpu cortex-m3
  .thumb
  .global asm_main
  .type asm_main, %function

// STM32F103 GPIO: base GPIOA 0x40010800, GPIOC 0x40011000
// IDR offset 0x08, ODR offset 0x0C
.equ	GPIOC_ODR,	0x4001100C	// For 7-seg on pins 0 to 7
.equ	GPIOA_IDR,	0x40010808	// For buttons on PA8 (skip) and PA13 (clock)
.equ	DELAY_COUNT,	  26667		// 10ms at 8 MHz HSI (3 cycles/iteration)


asm_main:

ldr r9, =0 // last clock state

restart:
ldr r2, =0 // counter from 0 -> 8
ldr r3, =8 // end value
ldr r4, =GPIOC_ODR

loop:

ldr r5, =0 // status reg for whether or not to skip a digit

ldr r0, =ssegdata    // r0 = address of segment LUT
ldr r1, =isodd      // r1 = address of even/odd LUT
ldrb r0, [r0, r2]    // r0 = segment pattern for digit r2
ldrb r1, [r1, r2]    // r1 = 1 if digit r2 is even

add r5, r1           // if the LUT says 1, the number COULD be skipped


//add r5, #0           // simulate button press, needs to be a UBFX
ldr r6, =GPIOA_IDR
ldr r6, [r6]
ubfx r6, r6, #8, #1  // read PA8 into r6
//eor r6, #1           // active low: pressed (0) -> 1, released (1) -> 0
add r5, r6

cmp r5, #2           // two conditions must be met to skip
beq increment        // odd: skip display and delay

str r0, [r4]         // even: output to hardware

wait:
// current clock input
ldr r8, =GPIOA_IDR
ldr r8, [r8]
ubfx r8, r8, #13, #1  // read PA13 into r8
eor r8, #1           // active low: pressed (0) -> 1, released (1) -> 0
cmp r8, r9
beq wait             // no change: keep waiting
mov r9, r8           // remember the new state
bl delay_10ms
cmp r8, #1
bne wait             // that was a release: keep waiting

increment:
add r2, r2, #1       // increment counter
cmp r2, r3
beq end

b     loop           // repeat forever (skip setup)

end:
b restart

delay_10ms:
    ldr  r7, =DELAY_COUNT
1:  subs r7, r7, #1
    bne  1b
    bx   lr              // return to caller (address saved in lr by bl)
            
.align 4
ssegdata:   // The LUT
/*
    .byte 0x39  // C
    .byte 0x4F  // 3
    .byte 0x6D  // 5
    .byte 0x06  // 1
    .byte 0x07  // 7
    .byte 0x06  // 1
    .byte 0x7D  // 6
    .byte 0x06  // 1
    */

    .byte 0x06
    .byte 0x7D
    .byte 0x06
    .byte 0x07
    .byte 0x06
    .byte 0x6D
    .byte 0x4F
    .byte 0x39

isodd:    // wake up babe new LUT just dropped
/*
    .byte 0x00  // C
    .byte 0x01  // 3
    .byte 0x01  // 5
    .byte 0x01  // 1
    .byte 0x01  // 7
    .byte 0x01  // 1
    .byte 0x00  // 6
    .byte 0x01  // 1
    */

    .byte 0x01
    .byte 0x00
    .byte 0x01
    .byte 0x01
    .byte 0x01
    .byte 0x01
    .byte 0x01
    .byte 0x00
