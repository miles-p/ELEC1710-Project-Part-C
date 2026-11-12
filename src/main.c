#include "stm32f1xx.h"

extern void asm_main(void); // defined in sseg.s, never returns

int main(void)
{
    // Enable clocks for GPIOA, GPIOC (F1: GPIO on APB2)
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_IOPCEN;
    // PC0-PC7: 7-segment outputs
    GPIOC->CRL = 0x22222222;

    asm_main();

    while (1)
    {
    } // not reached
}
