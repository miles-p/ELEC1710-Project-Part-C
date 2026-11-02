#include "stm32f1xx.h"

extern void asm_main(void);   // defined in main.s, never returns

int main(void)
{
    // Enable clocks for GPIOA, GPIOB, GPIOC
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_IOPBEN | RCC_APB2ENR_IOPCEN;

    // Each pin = 4 bits in CRL (pins 0-7) / CRH (pins 8-15)
    //   0x2 = push-pull output, 2 MHz
    //   0x4 = floating input
    //   0x8 = input with pull-up/pull-down (select via ODR)

    // PC0-PC7: 7-segment outputs
    GPIOC->CRL = 0x22222222;

    // PA5: Nucleo LED output
    GPIOA->CRL = (GPIOA->CRL & ~(0xFu << 20)) | (0x2u << 20);

    // PA8-PA11: tactile switches, floating inputs
    GPIOA->CRH = (GPIOA->CRH & ~0xFFFFu) | 0x4444u;

    // PB13: Nucleo button, floating input
    GPIOB->CRH = (GPIOB->CRH & ~(0xFu << 20)) | (0x4u << 20);

    asm_main();

    while (1) { }   // not reached
}
